import { describe, it, expect } from 'vitest';
import {
  formatLocationHit,
  formatListingCard,
  formatListingDetail,
  formatSaleCard,
  formatSoldDetail,
} from '../src/format.js';
import {
  LOCATION_HIT,
  LISTING_CARD,
  HOUSE_CARD,
  LISTING_DETAIL,
  SALE_CARD,
  SOLD_DETAIL,
} from './fixtures.js';

describe('formatLocationHit', () => {
  it('snake-cases the hit', () => {
    expect(formatLocationHit(LOCATION_HIT)).toEqual({
      location_id: '925970',
      full_name: 'Vasastan',
      parent_full_name: 'Stockholms kommun',
    });
  });
  it('nulls missing names', () => {
    expect(formatLocationHit({ locationId: '1' })).toEqual({
      location_id: '1',
      full_name: null,
      parent_full_name: null,
    });
  });
});

describe('formatListingCard', () => {
  it('normalises an apartment card with explicit price-per-m²', () => {
    const r = formatListingCard(LISTING_CARD);
    expect(r.price).toBe(2695000);
    expect(r.fee_monthly).toBe(1893);
    expect(r.price_per_sqm).toBe(114681);
    expect(r.coordinates).toEqual({ lat: 59.343, lng: 18.05 });
    expect(r.housing_form).toEqual({
      name: 'Lägenhet',
      symbol: 'APARTMENT',
      groups: ['APARTMENTS'],
    });
    expect(r.construction_year).toBe(1929);
    expect(r.tenure).toBe('Bostadsrätt');
  });

  it('derives price-per-m² when the API omits squareMeterPrice', () => {
    const r = formatListingCard(HOUSE_CARD);
    expect(r.price_per_sqm).toBe(Math.round(3995000 / 101));
    expect(r.fee_monthly).toBeNull();
    expect(r.land_area_sqm).toBe(350);
  });

  it('nulls everything on a sparse card', () => {
    const r = formatListingCard({ id: 'x' });
    expect(r).toMatchObject({
      price: null,
      price_per_sqm: null,
      housing_form: null,
      coordinates: null,
      construction_year: null,
      tenure: null,
      rooms: null,
    });
  });

  it('uses the formatted string when a Money amount is absent', () => {
    const r = formatListingCard({
      id: 'y',
      askingPrice: { formatted: '1 000 000 kr' },
      livingArea: 50,
    });
    expect(r.price).toBe(1000000);
    expect(r.price_per_sqm).toBe(20000);
  });

  it('does not divide by a zero living area', () => {
    const r = formatListingCard({
      id: 'z',
      askingPrice: { amount: 1000 },
      livingArea: 0,
    });
    expect(r.price_per_sqm).toBeNull();
  });

  it('nulls coordinates when only one axis is present', () => {
    expect(formatListingCard({ id: 'a', coordinates: { lat: 1, long: null } }).coordinates).toBeNull();
    expect(formatListingCard({ id: 'b', coordinates: { lat: null, long: 1 } }).coordinates).toBeNull();
  });

  it('nulls the construction year when the value holds no 4-digit year', () => {
    expect(formatListingCard({ id: 'c', legacyConstructionYear: 'okänt' }).construction_year).toBeNull();
  });

  it('defaults housing-form fields when the node has empty sub-fields', () => {
    const r = formatListingCard({ id: 'h', housingForm: {} });
    expect(r.housing_form).toEqual({ name: null, symbol: null, groups: [] });
  });
});

describe('formatListingDetail', () => {
  it('includes derived + detail fields and filters null photos/labels', () => {
    const r = formatListingDetail(LISTING_DETAIL);
    expect(r.running_costs_yearly).toBe(46390);
    expect(r.municipality).toBe('Södertälje kommun');
    expect(r.region).toBe('Stockholms län');
    expect(r.energy_class).toBe('D');
    expect(r.labels).toEqual(['Budgivning pågår']);
    expect(r.photos).toEqual([
      'https://bilder.hemnet.se/images/itemgallery_L/cd/79/a.jpg',
      'https://bilder.hemnet.se/images/itemgallery_L/41/3f/b.jpg',
    ]);
    expect(r.photo_count).toBe(43);
    expect(r.bidding_ongoing).toBe(true);
  });

  it('falls back to photo array length when total is absent', () => {
    const r = formatListingDetail({ id: 'x', images: { images: [{ url: 'a' }] } });
    expect(r.photo_count).toBe(1);
    expect(r.labels).toEqual([]);
    expect(r.photos).toEqual(['a']);
  });

  it('handles a detail node with no images block', () => {
    const r = formatListingDetail({ id: 'x' });
    expect(r.photos).toEqual([]);
    expect(r.photo_count).toBe(0);
  });
});

describe('formatSaleCard', () => {
  it('parses the string-typed sold card', () => {
    const r = formatSaleCard(SALE_CARD);
    expect(r.final_price).toBe(5950000);
    expect(r.asking_price).toBe(5795000);
    expect(r.price_change_percent).toBe(3);
    expect(r.rooms).toBe(2);
    expect(r.living_area_sqm).toBe(64);
    expect(r.price_per_sqm).toBe(92969);
    expect(r.url).toContain('/salda/');
  });

  it('nulls the url when slug is absent and derives price-per-m²', () => {
    const r = formatSaleCard({
      id: 's',
      finalPrice: '2 000 000 kr',
      livingArea: '40 m²',
    });
    expect(r.url).toBeNull();
    expect(r.price_per_sqm).toBe(50000);
  });

  it('nulls every field on an empty sale card', () => {
    const r = formatSaleCard({ id: 'e' });
    expect(r).toMatchObject({
      url: null,
      street_address: null,
      area: null,
      final_price: null,
      final_price_formatted: null,
      asking_price: null,
      price_per_sqm: null,
      housing_form: null,
    });
  });
});

describe('formatSoldDetail', () => {
  it('computes over-asking percent from the price change', () => {
    const r = formatSoldDetail(SOLD_DETAIL);
    expect(r.final_price).toBe(5950000);
    expect(r.price_change_amount).toBe(155000);
    expect(r.price_change_percent).toBe(2.7); // 155000/5795000 → 2.674 → 2.7
    expect(r.tenure).toBe('Bostadsrätt');
    expect(r.construction_year).toBe(2017);
  });

  it('nulls the percent when asking price is missing', () => {
    const r = formatSoldDetail({
      id: 's',
      sellingPrice: { amount: 100 },
      priceChange: { amount: 10 },
    });
    expect(r.price_change_percent).toBeNull();
  });
});
