/**
 * Hemnet GraphQL operations + raw response types.
 *
 * Hemnet.se is a Next.js/Apollo app backed by a public GraphQL endpoint
 * at `POST https://www.hemnet.se/graphql`. Unlike homes.com (which gates
 * every request behind AWS WAF at the session level and forces the
 * fetchproxy-per-call design), Hemnet serves these read queries to
 * anonymous clients with no auth, cookie, or CSRF token — so hemnet-mcp
 * talks to the API directly (see src/transport-direct.ts) instead of
 * riding a browser session.
 *
 * Introspection is DISABLED on the endpoint, so these operations were
 * reverse-engineered field-by-field from the SSR `__APOLLO_STATE__`
 * cache and the API's own "Did you mean" validation hints. Every field
 * selected here is confirmed live. When Hemnet changes a field, the
 * client's `parseLenient`-style guard surfaces a structured warning
 * rather than silently dropping data.
 *
 * The four surfaces:
 *   - `autocompleteLocations(query, limit)` — free-text → location ids
 *     (search takes numeric `locationIds`, never a place name).
 *   - `searchForSaleListings(search, limit, offset, sort)` — active
 *     for-sale listings. `listings` is the `PropertyListing` interface.
 *   - `searchSales(search, limit, offset, sort)` — sold listings
 *     ("slutpriser"), the killer Hemnet dataset. `cards` are `SaleCard`.
 *   - `listing(id)` / `soldListing(id)` — full detail nodes.
 */

// --- Fragments (composed into the operations below) --------------------

/** Structured `Money` node: `{ amount, formatted }`. */
const MONEY = 'amount formatted';

/** `HousingForm`: Villa / Lägenhet / Radhus / Parhus / Tomt / … */
const HOUSING_FORM = 'name symbol groups';

/** Interface-level fields shared by every for-sale `PropertyListing`. */
const LISTING_CARD_FIELDS = `
  __typename
  id
  streetAddress
  area
  numberOfRooms
  livingArea
  listingHemnetUrl
  askingPrice { ${MONEY} }
  fee { ${MONEY} }
  squareMeterPrice { ${MONEY} }
  housingForm { ${HOUSING_FORM} }
  coordinates { lat long }
  ... on ActivePropertyListing {
    daysOnHemnet
    supplementalArea
    landArea
    legacyConstructionYear
    tenure { name symbol }
    isNewConstruction
    isForeclosure
    isUpcoming
  }
`;

/** `SaleCard` fields (sold search results). String-typed money. */
const SALE_CARD_FIELDS = `
  __typename
  id
  streetAddress
  locationDescription
  slug
  finalPrice
  askingPrice
  priceChange
  soldAt
  soldAtLabel
  livingArea
  rooms
  squareMeterPrice
  fee
  landArea
  housingForm { ${HOUSING_FORM} }
  coordinates { lat long }
`;

/** Full `ActivePropertyListing` detail selection. */
const LISTING_DETAIL_FIELDS = `
  __typename
  id
  streetAddress
  area
  postCode
  numberOfRooms
  livingArea
  supplementalArea
  landArea
  formattedLivingArea
  formattedSupplementalArea
  formattedLandArea
  legacyConstructionYear
  daysOnHemnet
  timesViewed
  biddingStarted
  isBiddingOngoing
  isNewConstruction
  isForeclosure
  isUpcoming
  description
  listingHemnetUrl
  askingPrice { ${MONEY} }
  fee { ${MONEY} }
  runningCosts { ${MONEY} }
  squareMeterPrice { ${MONEY} }
  housingForm { ${HOUSING_FORM} }
  tenure { name symbol }
  coordinates { lat long }
  municipality { fullName }
  region { fullName }
  broker { name }
  brokerAgency { name }
  energyClassification { classification }
  labels { identifier category text }
`;

/** Full `SoldPropertyListing` detail selection. */
const SOLD_DETAIL_FIELDS = `
  __typename
  id
  streetAddress
  area
  numberOfRooms
  livingArea
  formattedLandArea
  legacyConstructionYear
  soldAt
  hemnetUrl
  sellingPrice { ${MONEY} }
  askingPrice { ${MONEY} }
  priceChange { ${MONEY} }
  squareMeterSellingPrice { ${MONEY} }
  housingForm { ${HOUSING_FORM} }
  tenure { name symbol }
  fee { ${MONEY} }
  coordinates { lat long }
  municipality { fullName }
  broker { name }
  brokerAgency { name }
`;

// --- Operations --------------------------------------------------------

export const AUTOCOMPLETE_LOCATIONS = `
  query AutocompleteLocations($query: String!, $limit: Int!) {
    autocompleteLocations(query: $query, limit: $limit) {
      hits { locationId fullName parentFullName }
    }
  }
`;

export const SEARCH_FOR_SALE = `
  query SearchForSale(
    $search: ListingSearchForSaleInput!
    $limit: Int!
    $offset: Int
    $sort: ListingSearchForSaleSorting
  ) {
    searchForSaleListings(
      search: $search
      limit: $limit
      offset: $offset
      sort: $sort
    ) {
      total
      listings { ${LISTING_CARD_FIELDS} }
    }
  }
`;

export const SEARCH_SALES = `
  query SearchSales(
    $search: SaleSearchInput!
    $limit: Int!
    $offset: Int
    $sort: SaleSearchSorting
  ) {
    searchSales(search: $search, limit: $limit, offset: $offset, sort: $sort) {
      total
      cards { ${SALE_CARD_FIELDS} }
    }
  }
`;

export const GET_LISTING = `
  query GetListing($id: ID!, $photoLimit: Int!) {
    listing(id: $id) {
      __typename
      ... on ActivePropertyListing {
        ${LISTING_DETAIL_FIELDS}
        images(limit: $photoLimit) {
          total
          images { url(format: ITEMGALLERY_L) }
        }
      }
    }
  }
`;

export const GET_SOLD_LISTING = `
  query GetSoldListing($id: ID!) {
    soldListing(id: $id) {
      __typename
      ... on SoldPropertyListing { ${SOLD_DETAIL_FIELDS} }
    }
  }
`;

// --- Raw response types ------------------------------------------------

/** A `Money` scalar node as returned by the detail queries. */
export interface RawMoney {
  amount?: number | null;
  formatted?: string | null;
}

export interface RawHousingForm {
  name?: string | null;
  symbol?: string | null;
  groups?: string[] | null;
}

export interface RawCoordinates {
  lat?: number | null;
  long?: number | null;
}

export interface RawNamed {
  name?: string | null;
  symbol?: string | null;
}

export interface RawLabel {
  identifier?: string | null;
  category?: string | null;
  text?: string | null;
}

export interface RawListingCard {
  __typename?: string;
  id: string;
  streetAddress?: string | null;
  area?: string | null;
  numberOfRooms?: number | null;
  livingArea?: number | null;
  listingHemnetUrl?: string | null;
  askingPrice?: RawMoney | null;
  fee?: RawMoney | null;
  squareMeterPrice?: RawMoney | null;
  housingForm?: RawHousingForm | null;
  coordinates?: RawCoordinates | null;
  daysOnHemnet?: number | null;
  supplementalArea?: number | null;
  landArea?: number | null;
  legacyConstructionYear?: string | null;
  tenure?: RawNamed | null;
  isNewConstruction?: boolean | null;
  isForeclosure?: boolean | null;
  isUpcoming?: boolean | null;
}

export interface RawSaleCard {
  __typename?: string;
  id: string;
  streetAddress?: string | null;
  locationDescription?: string | null;
  slug?: string | null;
  finalPrice?: string | null;
  askingPrice?: string | null;
  priceChange?: string | null;
  soldAt?: string | null;
  soldAtLabel?: string | null;
  livingArea?: string | null;
  rooms?: string | null;
  squareMeterPrice?: string | null;
  fee?: string | null;
  landArea?: string | null;
  housingForm?: RawHousingForm | null;
  coordinates?: RawCoordinates | null;
}

export interface RawListingDetail {
  __typename?: string;
  id: string;
  streetAddress?: string | null;
  area?: string | null;
  postCode?: string | null;
  numberOfRooms?: number | null;
  livingArea?: number | null;
  supplementalArea?: number | null;
  landArea?: number | null;
  formattedLivingArea?: string | null;
  formattedSupplementalArea?: string | null;
  formattedLandArea?: string | null;
  legacyConstructionYear?: string | null;
  daysOnHemnet?: number | null;
  timesViewed?: number | null;
  biddingStarted?: boolean | null;
  isBiddingOngoing?: boolean | null;
  isNewConstruction?: boolean | null;
  isForeclosure?: boolean | null;
  isUpcoming?: boolean | null;
  description?: string | null;
  listingHemnetUrl?: string | null;
  askingPrice?: RawMoney | null;
  fee?: RawMoney | null;
  runningCosts?: RawMoney | null;
  squareMeterPrice?: RawMoney | null;
  housingForm?: RawHousingForm | null;
  tenure?: RawNamed | null;
  coordinates?: RawCoordinates | null;
  municipality?: { fullName?: string | null } | null;
  region?: { fullName?: string | null } | null;
  broker?: { name?: string | null } | null;
  brokerAgency?: { name?: string | null } | null;
  energyClassification?: { classification?: string | null } | null;
  labels?: RawLabel[] | null;
  images?: {
    total?: number | null;
    images?: { url?: string | null }[] | null;
  } | null;
}

export interface RawSoldDetail {
  __typename?: string;
  id: string;
  streetAddress?: string | null;
  area?: string | null;
  numberOfRooms?: number | null;
  livingArea?: number | null;
  formattedLandArea?: string | null;
  legacyConstructionYear?: string | null;
  soldAt?: string | null;
  hemnetUrl?: string | null;
  sellingPrice?: RawMoney | null;
  askingPrice?: RawMoney | null;
  priceChange?: RawMoney | null;
  squareMeterSellingPrice?: RawMoney | null;
  housingForm?: RawHousingForm | null;
  tenure?: RawNamed | null;
  fee?: RawMoney | null;
  coordinates?: RawCoordinates | null;
  municipality?: { fullName?: string | null } | null;
  broker?: { name?: string | null } | null;
  brokerAgency?: { name?: string | null } | null;
}

/** `autocompleteLocations` hit. */
export interface RawLocationHit {
  locationId: string;
  fullName?: string | null;
  parentFullName?: string | null;
}

// --- Search input types ------------------------------------------------

/**
 * `HousingFormGroup` enum values accepted by the for-sale search input's
 * `housingFormGroups` filter. Confirmed live; the plural forms are the
 * ones the API accepts (`APARTMENTS`, not `APARTMENT`).
 */
export const HOUSING_FORM_GROUPS = [
  'HOUSES',
  'APARTMENTS',
  'ROW_HOUSES',
  'VACATION_HOMES',
  'PLOTS',
  'OTHERS',
] as const;
export type HousingFormGroup = (typeof HOUSING_FORM_GROUPS)[number];

/** `ListingSearchForSaleSorting` / `SaleSearchSorting` values. */
export const SORT_OPTIONS = ['NEWEST', 'OLDEST'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** Shape of the `ListingSearchForSaleInput` / `SaleSearchInput` we build. */
export interface HemnetSearchInput {
  locationIds: string[];
  priceMin?: number;
  priceMax?: number;
  roomsMin?: number;
  roomsMax?: number;
  livingAreaMin?: number;
  livingAreaMax?: number;
  housingFormGroups?: HousingFormGroup[];
  keywords?: string;
}
