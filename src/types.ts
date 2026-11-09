export type Usage = "unknown" | "usable" | "unusable"
export type Billing = "unpaid" | "paid"
export type Filter = "all" | Usage | "paid"
export type Sort = "nurture-long" | "nurture-short" | "email-new" | "email-old"

export type Account = {
  id: string
  email: string
  usage: Usage
  unusableReason: string
  billing: Billing
  emailRegisteredAt: string
  claudeRegisteredAt: string
  note: string
  checkedAt: string
  createdAt: string
  updatedAt: string
}

export type Draft = {
  email: string
  usage: Usage
  unusableReason: string
  billing: Billing
  emailRegisteredAt: string
  claudeRegisteredAt: string
  note: string
}

export const blankDraft = (): Draft => ({
  email: "",
  usage: "unknown",
  unusableReason: "",
  billing: "unpaid",
  emailRegisteredAt: "",
  claudeRegisteredAt: "",
  note: "",
})
