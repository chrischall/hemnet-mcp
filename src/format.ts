/**
 * Normalisers: raw Hemnet GraphQL nodes → clean, numeric, snake_cased
 * records.
 *
 * This module is the contract every consumer sees — the tools return
 * these shapes, and realty-meta (the planned cross-portal orchestrator in
 * realty-mcp) compares over them. So the job here is to erase Hemnet's
 * surface inconsistencies and expose stable, comparable primitives:
 *
 *   - Money is always a number of kronor (`price`, `fee_monthly`, …),
 *     never Hemnet's `"3 995 000 kr"` string. The original formatted
 *     string is kept alongside as `*_formatted` for display.
 *   - Areas are numbers of m² (`living_area_sqm`), rooms a number.
 *   - `coordinates.long` is renamed to the conventional `lng`.
 *   - A derived `price_per_sqm` is always present when price + area allow
 *     it (Hemnet omits `squareMeterPrice` on many houses).
 *
 * Everything Sweden-specific (SEK, m², `bostadsrätt`/`äganderätt`
 * tenure, BRF `avgift`) stays here rather than being pushed into
 * @chrischall/realty-core, whose helpers are US-centric (USD, sqft, ZIP).
 * realty-core's *portal-agnostic* helpers (address matching) are used in
 * src/tools/by-address.ts, not here.
 */
import { parseSekAmount, parseMeasurement, parsePercent } from './money.js';
import type {
  RawCoordinates,
  RawHousingForm,
  RawListingCard,
  RawListingDetail,
  RawMoney,
  RawSaleCard,
  RawSoldDetail,
  RawLocationHit,
} from './graphql.js';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface HousingForm {
  name: string | null;
  symbol: string | null;
  groups: string[];
}

export interface LocationHit {
  location_id: string;
  full_name: string | null;
  parent_full_name: string | null;
}

/** A for-sale search-result row. */
export interface ListingSummary {
  id: string;
  url: string | null;
  street_address: string | null;
  area: string | null;
  rooms: number | null;
  living_area_sqm: number | null;
  supplemental_area_sqm: number | null;
  land_area_sqm: number | null;
  price: number | null;
  price_formatted: string | null;
  fee_monthly: number | null;
  price_per_sqm: number | null;
  housing_form: HousingForm | null;
  tenure: string | null;
  construction_year: number | null;
  days_on_hemnet: number | null;
  is_new_construction: boolean | null;
  is_foreclosure: boolean | null;
  is_upcoming: boolean | null;
  coordinates: Coordinates | null;
}

/** A sold ("slutpris") search-result row / detail. */
export interface SoldSummary {
  id: string;
  url: string | null;
  street_address: string | null;
  area: string | null;
  rooms: number | null;
  living_area_sqm: number | null;
  land_area_sqm: number | null;
  final_price: number | null;
  final_price_formatted: string | null;
  asking_price: number | null;
  price_change_percent: number | null;
  price_change_amount: number | null;
  price_per_sqm: number | null;
  fee_monthly: number | null;
  housing_form: HousingForm | null;
  tenure: string | null;
  construction_year: number | null;
  sold_at: string | null;
  sold_label: string | null;
  coordinates: Coordinates | null;
}

/** Full for-sale detail record. */
export interface ListingDetail extends ListingSummary {
  post_code: string | null;
  running_costs_yearly: number | null;
  municipality: string | null;
  region: string | null;
  broker: string | null;
  broker_agency: string | null;
  energy_class: string | null;
  description: string | null;
  labels: string[];
  times_viewed: number | null;
  bidding_ongoing: boolean | null;
  photo_count: number | null;
  photos: string[];
}

// --- helpers -----------------------------------------------------------

function coords(c: RawCoordinates | null | undefined): Coordinates | null {
  if (c == null || c.lat == null || c.long == null) return null;
  return { lat: c.lat, lng: c.long };
}

function housing(h: RawHousingForm | null | undefined): HousingForm | null {
  if (h == null) return null;
  return {
    name: h.name ?? null,
    symbol: h.symbol ?? null,
    groups: h.groups ?? [],
  };
}

function moneyAmount(m: RawMoney | null | undefined): number | null {
  if (m == null) return null;
  if (typeof m.amount === 'number') return m.amount;
  return parseSekAmount(m.formatted);
}

/** Lexical year parse — Hemnet returns `legacyConstructionYear` as a string. */
function year(value: string | null | undefined): number | null {
  if (value == null) return null;
  const m = value.match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

/**
 * Derive price-per-m². Prefer Hemnet's own `squareMeterPrice`; fall back
 * to `price / living_area` when the API omits it (common on houses),
 * rounded to whole kronor.
 */
function pricePerSqm(
  explicit: number | null,
  price: number | null,
  livingArea: number | null,
): number | null {
  if (explicit != null) return explicit;
  if (price != null && livingArea != null && livingArea > 0) {
    return Math.round(price / livingArea);
  }
  return null;
}

// --- normalisers -------------------------------------------------------

export function formatLocationHit(hit: RawLocationHit): LocationHit {
  return {
    location_id: hit.locationId,
    full_name: hit.fullName ?? null,
    parent_full_name: hit.parentFullName ?? null,
  };
}

export function formatListingCard(card: RawListingCard): ListingSummary {
  const price = moneyAmount(card.askingPrice);
  const living = card.livingArea ?? null;
  return {
    id: card.id,
    url: card.listingHemnetUrl ?? null,
    street_address: card.streetAddress ?? null,
    area: card.area ?? null,
    rooms: card.numberOfRooms ?? null,
    living_area_sqm: living,
    supplemental_area_sqm: card.supplementalArea ?? null,
    land_area_sqm: card.landArea ?? null,
    price,
    price_formatted: card.askingPrice?.formatted ?? null,
    fee_monthly: moneyAmount(card.fee),
    price_per_sqm: pricePerSqm(moneyAmount(card.squareMeterPrice), price, living),
    housing_form: housing(card.housingForm),
    tenure: card.tenure?.name ?? null,
    construction_year: year(card.legacyConstructionYear),
    days_on_hemnet: card.daysOnHemnet ?? null,
    is_new_construction: card.isNewConstruction ?? null,
    is_foreclosure: card.isForeclosure ?? null,
    is_upcoming: card.isUpcoming ?? null,
    coordinates: coords(card.coordinates),
  };
}

export function formatListingDetail(node: RawListingDetail): ListingDetail {
  const price = moneyAmount(node.askingPrice);
  const living = node.livingArea ?? null;
  const photos = (node.images?.images ?? [])
    .map((i) => i.url)
    .filter((u): u is string => typeof u === 'string');
  return {
    id: node.id,
    url: node.listingHemnetUrl ?? null,
    street_address: node.streetAddress ?? null,
    area: node.area ?? null,
    rooms: node.numberOfRooms ?? null,
    living_area_sqm: living,
    supplemental_area_sqm: node.supplementalArea ?? null,
    land_area_sqm: node.landArea ?? null,
    price,
    price_formatted: node.askingPrice?.formatted ?? null,
    fee_monthly: moneyAmount(node.fee),
    price_per_sqm: pricePerSqm(moneyAmount(node.squareMeterPrice), price, living),
    housing_form: housing(node.housingForm),
    tenure: node.tenure?.name ?? null,
    construction_year: year(node.legacyConstructionYear),
    days_on_hemnet: node.daysOnHemnet ?? null,
    is_new_construction: node.isNewConstruction ?? null,
    is_foreclosure: node.isForeclosure ?? null,
    is_upcoming: node.isUpcoming ?? null,
    coordinates: coords(node.coordinates),
    post_code: node.postCode ?? null,
    running_costs_yearly: moneyAmount(node.runningCosts),
    municipality: node.municipality?.fullName ?? null,
    region: node.region?.fullName ?? null,
    broker: node.broker?.name ?? null,
    broker_agency: node.brokerAgency?.name ?? null,
    energy_class: node.energyClassification?.classification ?? null,
    description: node.description ?? null,
    labels: (node.labels ?? [])
      .map((l) => l.text)
      .filter((t): t is string => typeof t === 'string'),
    times_viewed: node.timesViewed ?? null,
    bidding_ongoing: node.isBiddingOngoing ?? null,
    photo_count: node.images?.total ?? photos.length,
    photos,
  };
}

export function formatSaleCard(card: RawSaleCard): SoldSummary {
  const final = parseSekAmount(card.finalPrice);
  const living = parseMeasurement(card.livingArea);
  return {
    id: card.id,
    url: card.slug ? `https://www.hemnet.se/salda/${card.slug}` : null,
    street_address: card.streetAddress ?? null,
    area: card.locationDescription ?? null,
    rooms: parseMeasurement(card.rooms),
    living_area_sqm: living,
    land_area_sqm: parseMeasurement(card.landArea),
    final_price: final,
    final_price_formatted: card.finalPrice ?? null,
    asking_price: parseSekAmount(card.askingPrice),
    price_change_percent: parsePercent(card.priceChange),
    price_change_amount: null,
    price_per_sqm: pricePerSqm(parseSekAmount(card.squareMeterPrice), final, living),
    fee_monthly: parseSekAmount(card.fee),
    housing_form: housing(card.housingForm),
    tenure: null,
    construction_year: null,
    sold_at: card.soldAt ?? null,
    sold_label: card.soldAtLabel ?? null,
    coordinates: coords(card.coordinates),
  };
}

export function formatSoldDetail(node: RawSoldDetail): SoldSummary {
  const final = moneyAmount(node.sellingPrice);
  const living = node.livingArea ?? null;
  const asking = moneyAmount(node.askingPrice);
  const changeAmount = moneyAmount(node.priceChange);
  return {
    id: node.id,
    url: node.hemnetUrl ?? null,
    street_address: node.streetAddress ?? null,
    area: node.area ?? null,
    rooms: node.numberOfRooms ?? null,
    living_area_sqm: living,
    land_area_sqm: parseMeasurement(node.formattedLandArea),
    final_price: final,
    final_price_formatted: node.sellingPrice?.formatted ?? null,
    asking_price: asking,
    price_change_percent:
      asking != null && asking > 0 && changeAmount != null
        ? Math.round((changeAmount / asking) * 1000) / 10
        : null,
    price_change_amount: changeAmount,
    price_per_sqm: pricePerSqm(moneyAmount(node.squareMeterSellingPrice), final, living),
    fee_monthly: moneyAmount(node.fee),
    housing_form: housing(node.housingForm),
    tenure: node.tenure?.name ?? null,
    construction_year: year(node.legacyConstructionYear),
    sold_at: node.soldAt ?? null,
    sold_label: null,
    coordinates: coords(node.coordinates),
  };
}
