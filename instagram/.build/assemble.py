#!/usr/bin/env python3
"""Cut Lina's three videos: tightened voice, real app clips, SF Pro subtitles."""

import array
import json
import math
import os
import re
import subprocess
import wave
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
INK = (37, 39, 32, 255)
ACCENT = (145, 112, 24, 255)
PAPER = (243, 243, 240, 235)
WHITE = (255, 255, 255, 255)
FONT = ImageFont.truetype(os.path.join(ROOT, "SFNS-Bold.ttf"), 56)
FONT_CTA = ImageFont.truetype(os.path.join(ROOT, "SFNS-Semibold.ttf"), 48)
GAP = {"snap": 0.26, "sheet": 0.55, "guess": 0.48}

SCRIPTS = {
    "snap": "I used to type every ingredient after dinner, and I always quit halfway through the list. Now I snap the plate instead. Zest names the food, and the calories appear right on the screen. Then the lemon reacts, like it already saw the plate. One photo keeps the whole day. No list, and no guessing. That is the diary. Get Zest.",
    "sheet": "I kept a spreadsheet for every meal, and I still lost the day. So I ditched it. I snap dinner, the calories land, and the lemon keeps what is left. The month is just a stack of plates. No more cells. Log a meal. Get Zest.",
    "guess": "Guess the calories on this plate. Pasta, garlic bread, the whole thing. I would have said four hundred, and I would have been way off. So I snap it. Zest names it, pasta and garlic bread, and the number comes back at eleven twenty. The lemon does not panic. It just keeps the day, and it says I am fine. That is the game. Guess, then snap, then see the number. The diary writes itself.",
}

# Shot names resolved against the spoken word that starts them.
SHOTS = {
    "snap": [("face", None), ("camera", "snap"), ("calories", "calories"), ("day", "month") if False else ("lemon", "lemon"), ("card", "Get")],
    "sheet": [("face", None), ("camera", "snap"), ("calories", "calories"), ("day", "month"), ("card", "Get")],
    "guess": [("face", None), ("camera", "snap"), ("calories", "number"), ("lemon", "lemon"), ("day", "day"), ("card", "diary")],
}
# snap has no "month"; card starts at Get. Fix snap shots below.
SHOTS["snap"] = [("face", None), ("camera", "snap"), ("calories", "calories"), ("lemon", "lemon"), ("card", "Get")]


def run(cmd):
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def read_pcm(path):
    raw = os.path.join(ROOT, "_pcm.wav")
    run(["ffmpeg", "-y", "-i", path, "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", raw])
    with wave.open(raw, "rb") as w:
        pcm = w.readframes(w.getnframes())
    return pcm, 48000


def rms_mask(pcm, rate, win=0.02, thresh=500):
    n = win * rate
    step = int(n)
    samples = memoryview(pcm).cast("h")
    flags = []
    for i in range(0, len(samples) - step, step):
        acc = 0
        for s in samples[i:i + step]:
            acc += s * s
        flags.append((acc / step) ** 0.5 >= thresh)
    return flags, step


def speech_spans(flags, step, rate):
    spans = []
    i = 0
    while i < len(flags):
        if not flags[i]:
            i += 1
            continue
        j = i
        while j < len(flags) and flags[j]:
            j += 1
        a, b = i * step / rate, j * step / rate
        if b - a >= 0.08:
            spans.append((a, b))
        i = j
    return spans


def tighten(src, dst, gap):
    pcm, rate = read_pcm(src)
    flags, step = rms_mask(pcm, rate)
    spans = speech_spans(flags, step, rate)
    merged = []
    for a, b in spans:
        if merged and a - merged[-1][1] < 0.12:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append([a, b])
    spans = [(a, b) for a, b in merged]
    samples = memoryview(pcm).cast("h")
    out = []
    lead = [0] * int(0.06 * rate)
    out.extend(lead)
    pieces = []
    t = 0.06
    for k, (a, b) in enumerate(spans):
        i0, i1 = int(a * rate), int(b * rate)
        out.extend(samples[i0:i1])
        pieces.append((t, t + (i1 - i0) / rate))
        t += (i1 - i0) / rate
        if k != len(spans) - 1:
            original = spans[k + 1][0] - b
            hold = min(max(original, 0.12), gap)
            out.extend([0] * int(hold * rate))
            t += hold
    out.extend([0] * int(0.16 * rate))
    frames = array.array("h", out).tobytes()
    with wave.open(dst, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(frames)
    return pieces, t + 0.16


def words_of(text):
    return re.findall(r"[A-Za-z0-9']+|[,.]", text)


def align(text, pieces):
    tokens = words_of(text)
    words = [(tok, tok not in ",.") for tok in tokens]
    real = [w for w, keep in words if keep]
    weight = [max(len(w), 1) for w in real]
    total = sum(weight)
    speech = sum(b - a for a, b in pieces)
    # walk speech timeline
    cursor = 0.0
    span_i = 0
    pos = pieces[0][0]
    times = []
    for w, wt in zip(real, weight):
        dur = speech * wt / total
        start = pos
        left = dur
        while left > 0 and span_i < len(pieces):
            a, b = pieces[span_i]
            if pos < a:
                pos = a
            room = b - pos
            if left <= room + 1e-4:
                pos += left
                left = 0
            else:
                left -= room
                span_i += 1
                if span_i < len(pieces):
                    pos = pieces[span_i][0]
        times.append((w, start, max(pos, start + 0.06)))
    return times


CUES = {
    "snap": [
        "I used to type",
        "every ingredient",
        "after dinner",
        "and I always quit",
        "halfway through the list",
        "Now I snap",
        "the plate instead",
        "Zest names the food",
        "and the calories appear",
        "right on the screen",
        "Then the lemon reacts",
        "like it already saw",
        "the plate",
        "One photo keeps",
        "the whole day",
        "No list",
        "and no guessing",
        "That is the diary",
        "Get Zest",
    ],
    "sheet": [
        "I kept a spreadsheet",
        "for every meal",
        "and I still lost",
        "the day",
        "So I ditched it",
        "I snap dinner",
        "the calories land",
        "and the lemon keeps",
        "what is left",
        "The month is just",
        "a stack of plates",
        "No more cells",
        "Log a meal",
        "Get Zest",
    ],
    "guess": [
        "Guess the calories",
        "on this plate",
        "Pasta garlic bread",
        "the whole thing",
        "I would have said",
        "four hundred",
        "and I would have been",
        "way off",
        "So I snap it",
        "Zest names it",
        "pasta and garlic bread",
        "and the number comes back",
        "at eleven twenty",
        "The lemon does not panic",
        "It just keeps the day",
        "and it says",
        "I am fine",
        "That is the game",
        "Guess then snap",
        "then see the number",
        "The diary writes itself",
    ],
}


def phrases(key, times):
    sizes = [len(re.findall(r"[A-Za-z0-9']+", cue)) for cue in CUES[key]]
    if sum(sizes) != len(times):
        raise SystemExit(f"{key}: cues cover {sum(sizes)} words, speech has {len(times)}")
    groups = []
    i = 0
    for n in sizes:
        groups.append(times[i:i + n])
        i += n
    return groups


def text_size(draw, text, font):
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def draw_phrase(base, group, now, fade):
    img = base.copy()
    draw = ImageDraw.Draw(img)
    words = [w for w, _, _ in group]
    # wrap into two lines, aiming for a balanced split
    if len(words) <= 3:
        lines = [words]
    else:
        split = 3 if len(words) >= 5 else 2
        lines = [words[:split], words[split:]]
    sizes = []
    for line in lines:
        sizes.append(text_size(draw, " ".join(line), FONT))
    block_w = max(s[0] for s in sizes)
    line_h = sizes[0][1] + 14
    block_h = line_h * len(lines)
    x0 = (W - block_w) / 2
    y0 = int(H * 0.76) - block_h / 2
    pad_x, pad_y = 28, 18
    pill = Image.new("RGBA", img.size, (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    rect = [x0 - pad_x, y0 - pad_y, x0 + block_w + pad_x, y0 + block_h + pad_y]
    pd.rounded_rectangle(rect, radius=28, fill=(243, 243, 240, int(235 * fade)))
    shadow = pill.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, shadow)
    img = Image.alpha_composite(img, pill)
    draw = ImageDraw.Draw(img)
    # paint word by word so the current one can change color
    idx = 0
    for li, line in enumerate(lines):
        line_w = sizes[li][0]
        x = (W - line_w) / 2
        y = y0 + li * line_h
        for word in line:
            _, a, b = group[idx]
            color = ACCENT if a - 0.02 <= now < b + 0.04 else INK
            color = (*color[:3], int(255 * fade))
            draw.text((x, y), word, font=FONT, fill=color)
            ww = text_size(draw, word + " ", FONT)[0]
            x += ww
            idx += 1
    return img


def draw_card(label):
    img = Image.new("RGBA", (W, H), (243, 243, 240, 255))
    draw = ImageDraw.Draw(img)
    box = draw.textbbox((0, 0), label, font=FONT_CTA)
    tw, th = box[2] - box[0], box[3] - box[1]
    pw, ph = tw + 96, th + 52
    x = (W - pw) / 2
    y = H * 0.56
    draw.rounded_rectangle([x, y, x + pw, y + ph], radius=ph / 2, fill=INK)
    draw.text((x + 48 - box[0], y + 26 - box[1]), label, font=FONT_CTA, fill=WHITE)
    return img


def cover(src, start, dur, dst, zoom=False):
    # The recording is the full phone screen. Sit it on the paper color.
    # A calorie shot scales up slightly so the number reads sooner.
    if zoom:
        vf = "scale=990:2150,crop=990:1920:0:80,pad=1080:1920:(1080-iw)/2:0:color=0xF3F3F0,fps=30"
    else:
        vf = "scale=883:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2:color=0xF3F3F0,fps=30"
    run(["ffmpeg", "-y", "-stream_loop", "-1", "-ss", str(start), "-t", f"{dur:.3f}", "-i", src, "-an", "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", dst])


def face_clip(dur, dst):
    src = os.path.join(ROOT, "lina-face.jpg")
    frames = max(1, int(dur * FPS))
    run(["ffmpeg", "-y", "-loop", "1", "-framerate", "30", "-i", src, "-frames:v", str(frames), "-vf", "scale=1080:1920,fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", dst])


def word_time(times, needle):
    for w, a, b in times:
        if w.lower().startswith(needle.lower()):
            return a
    return None


def render(key, times, groups, dur):
    marks = []
    for name, needle in SHOTS[key]:
        if name == "card":
            continue
        t = 0.0 if needle is None else word_time(times, needle)
        if t is None:
            continue
        marks.append((t, name))
    marks.append((max(0.0, dur - 2.0), "card"))
    marks.sort()
    marks.append((dur, "end"))
    clips = []
    for i in range(len(marks) - 1):
        t0, name = marks[i]
        t1 = marks[i + 1][0]
        if t1 - t0 < 0.35:
            continue
        part = os.path.join(ROOT, f"{key}-{i}.mp4")
        if name == "face":
            face_clip(t1 - t0, part)
        elif name == "card":
            card = draw_card("Get Zest" if key != "guess" else "Log a meal")
            card_path = os.path.join(ROOT, f"{key}-card.png")
            card.convert("RGB").save(card_path, "PNG")
            frames = max(1, int((t1 - t0) * FPS))
            run(["ffmpeg", "-y", "-loop", "1", "-i", card_path, "-frames:v", str(frames), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", part])
        else:
            src = {
                "camera": "app-camera.mp4",
                "calories": "app-calories.mp4",
                "lemon": "app-lemon.mp4",
                "day": "app-day.mp4",
            }[name]
            cover(os.path.join(ROOT, src), 0.3, t1 - t0, part, zoom=(name == "calories"))
        clips.append(part)
    lst = os.path.join(ROOT, f"{key}-list.txt")
    with open(lst, "w") as f:
        for c in clips:
            f.write(f"file '{c}'\n")
    silent = os.path.join(ROOT, f"{key}-silent.mp4")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent])
    # subtitles
    overlay = os.path.join(ROOT, f"{key}-sub.mov")
    write_subs(groups, dur, overlay, skip_from=max(0.0, dur - 2.0))
    out_name = {"snap": "ad-01-snap-the-plate.mp4", "sheet": "ad-03-ditch-the-spreadsheet.mp4", "guess": "reel-02-guess.mp4"}[key]
    dest = os.path.join(os.path.dirname(ROOT), out_name)
    audio = os.path.join(ROOT, f"{key}-tight.wav")
    run([
        "ffmpeg", "-y", "-i", silent, "-i", overlay, "-i", audio,
        "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto[v]",
        "-map", "[v]", "-map", "2:a",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart", dest,
    ])
    print("wrote", dest)


def write_subs(groups, dur, dest, skip_from):
    frames = int(math.ceil(dur * FPS))
    cmd = [
        "ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}",
        "-r", str(FPS), "-i", "-", "-c:v", "qtrle", dest,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    blank = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for n in range(frames):
        now = n / FPS
        img = blank
        if skip_from is None or now < skip_from:
            for group in groups:
                a = group[0][1]
                b = group[-1][2]
                if a - 0.05 <= now <= b + 0.12:
                    fade = 1.0
                    if now < a + 0.3:
                        fade = max(0.0, (now - (a - 0.05)) / 0.3)
                    img = draw_phrase(blank, group, now, fade)
                    break
        proc.stdin.write(img.tobytes())
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError("subtitle encode failed")


def main():
    os.chdir(ROOT)
    jobs = {
        "snap": "lina-ad-snap.wav",
        "sheet": "lina-ad-sheet.wav",
        "guess": "lina-reel-guess.wav",
    }
    for key, src in jobs.items():
        pieces, dur = tighten(src, f"{key}-tight.wav", GAP[key])
        times = align(SCRIPTS[key], pieces)
        groups = phrases(key, times)
        for g in groups:
            print(" ", " ".join(w for w, _, _ in g))
        print(key, f"{dur:.2f}s", "phrases", len(groups))
        render(key, times, groups, dur)


if __name__ == "__main__":
    main()
