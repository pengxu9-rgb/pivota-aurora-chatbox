import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DupeSuggestCard } from "@/components/aurora/cards/DupeSuggestCard";

describe("DupeSuggestCard compare guard", () => {
  it("disables compare when original is not comparable", () => {
    render(
      <DupeSuggestCard
        original={{}}
        dupes={[
          {
            kind: "dupe",
            product: { brand: "MockBrand", name: "Mock Cream" },
          },
        ]}
        comparables={[]}
        language="EN"
        onCompare={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
    expect(screen.getByText("Need a clearer target product")).toBeInTheDocument();
  });

  it("disables compare for suspected self references", () => {
    render(
      <DupeSuggestCard
        original={{
          brand: "Lab Series",
          name: "Daily Rescue Energizing Lightweight Lotion Moisturizer",
          url: "https://www.labseries.com/product/daily-rescue",
        }}
        dupes={[
          {
            kind: "dupe",
            product: {
              brand: "Lab Series",
              name: "Daily Rescue Energizing Lightweight Lotion Moisturizer (budget dupe)",
              url: "https://www.labseries.com/product/daily-rescue?utm_source=test",
            },
          },
        ]}
        comparables={[]}
        language="EN"
        onCompare={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
    expect(screen.getByText("This is the same product")).toBeInTheDocument();
  });

  it("keeps compare enabled for distinct candidates", () => {
    const onCompare = vi.fn();
    render(
      <DupeSuggestCard
        original={{
          brand: "The Ordinary",
          product_name: "Niacinamide 10% + Zinc 1%",
          url: "https://www.sephora.com/product/the-ordinary-niacinamide-10-zinc-1-P427417",
        }}
        dupes={[
          {
            kind: "dupe",
            product: {
              brand: "Good Molecules",
              display_name: "Niacinamide Serum",
              url: "https://example.com/good-molecules-niacinamide-serum",
            },
          },
        ]}
        comparables={[]}
        language="EN"
        onCompare={onCompare}
      />,
    );

    const button = screen.getByRole("button", { name: "Compare" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onCompare).toHaveBeenCalledTimes(1);
  });
});
