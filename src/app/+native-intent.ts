/** Invite links open the diary with the friend's code: zest://friend/abc → /?friend=abc */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const match = /(?:^|\/)friend\/([\w-]+)/.exec(path);
  return match ? `/?friend=${match[1]}` : path;
}
