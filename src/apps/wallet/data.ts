import { at, HOUR, MIN } from '../../os/time'

export interface Txn { id: string; merchant: string; amount: number; ts: number; cat: string; color: string; pending?: boolean; note?: string }

const now = Date.now()

export const TXNS: Record<string, Txn[]> = {
  'w-debit': [
    { id: 'd1', merchant: 'Brew Lab Coffee', amount: -4.95, ts: now - 5 * HOUR, cat: 'Food & Drink', color: '#a0673a' },
    { id: 'd2', merchant: 'Maple Grove Metro', amount: -10, ts: at(-1, 8, 2), cat: 'Transport', color: '#ff9500', note: 'Transit card top-up' },
    { id: 'd3', merchant: 'Parts Depot', amount: -38.4, ts: at(-2, 17, 40), cat: 'Shopping', color: '#5856d6' },
    { id: 'd4', merchant: 'Paycheck — Riverside Library', amount: 142.5, ts: at(-4, 9, 0), cat: 'Income', color: '#34c759' },
    { id: 'd5', merchant: "Rosa's Trattoria", amount: -21.6, ts: at(-3, 20, 12), cat: 'Food & Drink', color: '#ff3b30' },
    { id: 'd6', merchant: 'Greenfield Outfitters', amount: -64, ts: at(-8, 14, 30), cat: 'Shopping', color: '#30b0c7' },
  ],
  'w-credit': [
    { id: 'c1', merchant: 'Bolt Electronics', amount: -89.99, ts: at(-1, 16, 10), cat: 'Electronics', color: '#ff9f0a', pending: true },
    { id: 'c2', merchant: 'Streamly (Demo)', amount: -9.99, ts: at(-6, 0, 5), cat: 'Subscriptions', color: '#af52de' },
    { id: 'c3', merchant: 'Skyward Airlines', amount: -212.4, ts: at(-12, 11, 30), cat: 'Travel', color: '#0a84ff' },
    { id: 'c4', merchant: 'Payment — Thank you', amount: 150, ts: at(-14, 9, 0), cat: 'Payment', color: '#34c759' },
  ],
  'w-cash': [
    { id: 'a1', merchant: 'From Alex Rivera', amount: 21.6, ts: at(-3, 22, 1), cat: 'Apple Cash', color: '#34c759', note: 'Rosa’s split 🍝' },
    { id: 'a2', merchant: 'To Sam Okafor', amount: -8, ts: at(-5, 12, 44), cat: 'Apple Cash', color: '#8e8e93', note: 'Drum sticks' },
    { id: 'a3', merchant: 'Daily Cash', amount: 1.12, ts: at(-6, 6, 0), cat: 'Rewards', color: '#ff9f0a' },
  ],
  'w-transit': [
    { id: 't1', merchant: 'Route 12 — Lincoln Ave', amount: -2.25, ts: now - 7 * HOUR, cat: 'Bus', color: '#ff9500' },
    { id: 't2', merchant: 'Route 12 — Main St', amount: -2.25, ts: at(-1, 15, 20), cat: 'Bus', color: '#ff9500' },
    { id: 't3', merchant: 'Top-up', amount: 10, ts: at(-1, 8, 2), cat: 'Reload', color: '#34c759' },
  ],
}

export const CAR_KEY = {
  id: 'w-carkey',
  kind: 'key' as const,
  name: 'Car Key',
  issuer: 'Demo Motors',
  gradient: 'linear-gradient(145deg,#2b2e33,#5b6068 55%,#9aa0a8)',
  textColor: '#fff',
  details: { Vehicle: '2026 Demo Motors Aria EV', Color: 'Glacier Gray', 'Express Mode': 'On', 'Keys Shared': '1 (Mom)', 'Unlock': 'Hold near door handle' },
}

export const MERCHANT = { name: 'Brew Lab Coffee', amount: 5.75, items: [{ label: 'Oat Latte (12 oz)', price: 5.25 }, { label: 'Tax', price: 0.5 }] }

export const fmtMoney = (n: number) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`

export const MIN_ = MIN
