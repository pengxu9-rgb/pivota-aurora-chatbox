import { describe, it, expect } from "vitest";

import { extractExternalVerificationCitations } from "@/lib/auroraExternalVerification";

describe("aurora external_verification", () => {
  it("extracts citations from structured payload", () => {
    const payload = {
      schema_version: "aurora.structured.v1",
      external_verification: {
        citations: [
          {
            title: "Niacinamide - mechanisms of action and its topical use in dermatology.",
            source: "Skin pharmacology and physiology",
            year: 2014,
            url: "https://pubmed.ncbi.nlm.nih.gov/24993939/",
            note: "PMID:24993939",
          },
        ],
      },
    };

    const citations = extractExternalVerificationCitations(payload);
    expect(citations).toHaveLength(1);
    expect(citations[0]?.title).toContain("Niacinamide");
    expect(citations[0]?.url).toContain("pubmed.ncbi.nlm.nih.gov");
    expect(citations[0]?.note).toContain("PMID:24993939");
  });

  it("extracts citations from nested structured/context wrappers", () => {
    const payload = {
      structured: {
        external_verification: {
          citations: [
            {
              title: "Topical niacinamide reduces yellowing, wrinkling, red blotchiness, and hyperpigmented spots in aging facial skin.",
              source: "International journal of cosmetic science",
              year: "2004",
              url: "https://pubmed.ncbi.nlm.nih.gov/18492135/",
              note: "PMID:18492135",
            },
          ],
        },
      },
    };

    const citations = extractExternalVerificationCitations(payload);
    expect(citations).toHaveLength(1);
    expect(citations[0]?.year).toBe(2004);
  });

  it("dedupes citations by url/note/title", () => {
    const payload = {
      external_verification: {
        citations: [
          { title: "Paper A", url: "https://pubmed.ncbi.nlm.nih.gov/12345678/", note: "PMID:12345678" },
          { title: "Paper A (dup)", url: "https://pubmed.ncbi.nlm.nih.gov/12345678/", note: "PMID:12345678" },
          { title: "Paper B", note: "PMID:99999999" },
          { title: "Paper B (dup)", note: "PMID:99999999" },
        ],
      },
    };

    const citations = extractExternalVerificationCitations(payload);
    expect(citations).toHaveLength(2);
  });
});

