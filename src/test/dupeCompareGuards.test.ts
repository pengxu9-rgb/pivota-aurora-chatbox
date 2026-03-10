import { describe, expect, it } from "vitest";

import {
  isComparableProductLike,
  looksLikeSelfRef,
  readComparableIdentity,
} from "@/lib/dupeCompareGuards";

describe("dupeCompareGuards", () => {
  it("accepts legacy product_name anchors as comparable", () => {
    expect(
      isComparableProductLike({
        brand: "The Ordinary",
        product_name: "Niacinamide 10% + Zinc 1%",
      }),
    ).toBe(true);
  });

  it("unwraps nested product candidates", () => {
    const identity = readComparableIdentity({
      kind: "dupe",
      product: {
        brand: "MockBrand",
        title: "Mock Serum",
        product_id: "mock_1",
      },
    });

    expect(identity.brand).toBe("MockBrand");
    expect(identity.name).toBe("Mock Serum");
    expect(identity.productId).toBe("mock_1");
  });

  it("detects self reference by normalized url and suffix-stripped name", () => {
    expect(
      looksLikeSelfRef(
        {
          brand: "Lab Series",
          name: "Daily Rescue Energizing Lightweight Lotion Moisturizer",
          url: "https://www.labseries.com/product/daily-rescue?utm_source=test",
        },
        {
          brand: "Lab Series",
          name: "Daily Rescue Energizing Lightweight Lotion Moisturizer (budget dupe)",
          url: "https://www.labseries.com/product/daily-rescue",
        },
      ),
    ).toBe(true);
  });

  it("detects self reference when the candidate brand is missing but the suffix-stripped name matches", () => {
    expect(
      looksLikeSelfRef(
        {
          name: "The Ordinary Niacinamide 10% + Zinc 1%",
        },
        {
          name: "The Ordinary Niacinamide 10% + Zinc 1% (budget dupe)",
          brand: null,
          product_id: null,
          url: null,
        },
      ),
    ).toBe(true);
  });

  it("detects self reference when the anchor brand is split from the name but the candidate name contains the full title", () => {
    expect(
      looksLikeSelfRef(
        {
          brand: "The Ordinary",
          name: "Niacinamide 10% + Zinc 1%",
        },
        {
          name: "The Ordinary Niacinamide 10% + Zinc 1%",
          product_id: "9886499864904",
          url: "https://agent.pivota.cc/products/9886499864904",
        },
      ),
    ).toBe(true);
  });

  it("keeps same-brand but different-line products comparable", () => {
    expect(
      looksLikeSelfRef(
        {
          brand: "Lab Series",
          name: "Daily Rescue Energizing Lightweight Lotion Moisturizer",
        },
        {
          brand: "Lab Series",
          name: "MAX LS Age-Less Power V Lifting Cream",
        },
      ),
    ).toBe(false);
  });
});
