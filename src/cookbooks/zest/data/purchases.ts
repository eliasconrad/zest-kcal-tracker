/**
 * StoreKit 2 through expo-iap. A purchase only counts once the Worker has
 * checked Apple's signature; then the transaction is finished.
 */
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type ProductSubscription,
  type Purchase,
} from "expo-iap";
import { productIds, type PlanId } from "./plans";
import { session } from "../state/useSession";

export type StorePlan = {
  id: PlanId;
  sku: string;
  displayPrice: string;
  price: number;
  currency: string;
  /** Set only when the store actually offers a free trial. */
  trialDays: number | null;
};

let connected: Promise<unknown> | null = null;
const connect = () => (connected ??= initConnection());

function trialDays(product: ProductSubscription) {
  const ios = product as ProductSubscription & {
    introductoryPricePaymentModeIOS?: string;
    introductoryPriceNumberOfPeriodsIOS?: string | null;
    introductoryPriceSubscriptionPeriodIOS?: string | null;
  };
  if (ios.introductoryPricePaymentModeIOS !== "free-trial") return null;
  const count = Number(ios.introductoryPriceNumberOfPeriodsIOS) || 1;
  const unit = ios.introductoryPriceSubscriptionPeriodIOS;
  return unit === "week" ? count * 7 : unit === "month" ? count * 30 : count;
}

/** The plans as the store sells them today. Empty when the store cannot answer. */
export async function loadPlans(): Promise<StorePlan[]> {
  await connect();
  const products = (await fetchProducts({
    skus: Object.values(productIds),
    type: "subs",
  })) as ProductSubscription[] | null;
  return (["yearly", "monthly"] as const).flatMap((id) => {
    const product = products?.find((item) => item.id === productIds[id]);
    if (!product) return [];
    return [
      {
        id,
        sku: product.id,
        displayPrice: product.displayPrice,
        price: product.price ?? 0,
        currency: product.currency,
        trialDays: trialDays(product),
      },
    ];
  });
}

async function settle(purchase: Purchase) {
  if (!purchase.purchaseToken) return false;
  const result = await session.post<{ pro: boolean; proUntil: number }>("/v1/purchase", {
    jws: purchase.purchaseToken,
  });
  session.setPro(result.pro, result.proUntil);
  await finishTransaction({ purchase, isConsumable: false });
  return result.pro;
}

/** Resolves true once the Worker has confirmed Pro, false if the person backed out. */
export function buy(plan: StorePlan) {
  return new Promise<boolean>((resolve, reject) => {
    void (async () => {
      await connect();
      await session.ensure();
      const done = (fn: () => void) => {
        updated.remove();
        failed.remove();
        fn();
      };
      const updated = purchaseUpdatedListener((purchase) => {
        void settle(purchase).then(
          (pro) => done(() => resolve(pro)),
          (error) => done(() => reject(error)),
        );
      });
      const failed = purchaseErrorListener((error) => {
        done(() => (String(error.code).includes("cancel") ? resolve(false) : reject(error)));
      });
      await requestPurchase({
        request: {
          apple: {
            sku: plan.sku,
            appAccountToken: session.user()?.id,
          },
        },
        type: "subs",
      }).catch((error) => done(() => reject(error)));
    })().catch(reject);
  });
}

/** Restore Purchases: sends everything the App Store still knows to the Worker. */
export async function restore() {
  await connect();
  await session.ensure();
  const purchases = await getAvailablePurchases();
  let pro = false;
  for (const purchase of purchases) pro = (await settle(purchase)) || pro;
  return pro;
}

export const disconnectStore = () => {
  connected = null;
  return endConnection();
};
