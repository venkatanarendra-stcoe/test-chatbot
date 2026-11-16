import { Bike, Car, HeartPulse, Home, Plane, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Policy } from "@/services/api";

export function productIcon(p: Pick<Policy, "policy_type" | "product">): LucideIcon {
  if (p.policy_type === "Health") return HeartPulse;
  if (p.policy_type === "Motor") return /two/i.test(p.product) ? Bike : Car;
  if (p.policy_type === "Home") return Home;
  if (p.policy_type === "Travel") return Plane;
  return ShieldCheck;
}

/** % of the policy period elapsed (for the validity bar). */
export function validity(p: Pick<Policy, "start_date" | "end_date">): number {
  const s = new Date(p.start_date).getTime(), e = new Date(p.end_date).getTime();
  return e <= s ? 0 : ((Date.now() - s) / (e - s)) * 100;
}

export const POLICY_STATUSES = ["Active", "Grace Period", "Lapsed", "Expired", "Pending"];
export const POLICY_TYPES = ["Health", "Life", "Motor", "Home", "Travel"];
export const CLAIM_STATUSES = ["Submitted", "Under Review", "Documents Pending", "Approved", "Settled", "Rejected"];
export const PAYMENT_STATUSES = ["Success", "Failed", "Pending"];
