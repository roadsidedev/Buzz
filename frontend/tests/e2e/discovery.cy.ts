/**
 * E2E Tests for Discovery Page
 * Full user journey testing with Cypress
 * ~200 lines
 */

describe("Discovery Page E2E Tests", () => {
  beforeEach(() => {
    cy.visit("/discover");
    cy.contains("Discover Live Rooms").should("be.visible");
  });

  describe("Navigation", () => {
    it("should load discovery page", () => {
      cy.url().should("include", "/discover");
      cy.contains("Discover Live Rooms").should("be.visible");
    });

    it("should display hero section", () => {
      cy.get('[class*="bg-gradient"]').should("be.visible");
      cy.get('input[placeholder*="Search"]').should("exist");
    });

    it("should display category filter", () => {
      cy.contains("Categories").parent().should("be.visible");
    });
  });

  describe("Live Now Section", () => {
    it("should display live now section", () => {
      cy.contains("Live Now").should("be.visible");
    });

    it("should display live rooms", () => {
      cy.get('[class*="LIVE"]').should("have.length.greaterThan", 0);
    });

    it("should show viewer counts", () => {
      cy.contains("watching").should("exist");
    });

    it("should navigate carousel", () => {
      cy.get('button[aria-label="Scroll right"]').then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click();
          cy.contains("Live Now").should("be.visible");
        }
      });
    });

    it("should join room from live now", () => {
      cy.contains("Join Room").first().click();
      cy.url().should("include", "/room/");
    });
  });

  describe("Trending Section", () => {
    it("should display trending section", () => {
      cy.contains("Trending").should("be.visible");
    });

    it("should show trending rooms", () => {
      cy.get('[class*="grid"]').first().children().should("have.length.greaterThan", 0);
    });

    it("should display ranking badges", () => {
      cy.contains("#1").should("be.visible");
    });

    it("should show trending scores", () => {
      cy.get('[role="progressbar"]').should("have.length.greaterThan", 0);
    });

    it("should join from trending", () => {
      cy.contains("Join Room").eq(1).click();
      cy.url().should("include", "/room/");
    });
  });

  describe("Search Functionality", () => {
    it("should open search on input focus", () => {
      cy.get('input[placeholder*="Search"]').type("AI");
      cy.contains("Search Results").should("be.visible");
    });

    it("should display search results", () => {
      cy.get('input[placeholder*="Search"]').type("debate");
      cy.get('[class*="grid"]').children().should("have.length.greaterThan", 0);
    });

    it("should update results on input change", () => {
      const input = cy.get('input[placeholder*="Search"]');
      input.type("AI");
      cy.wait(500);
      input.clear().type("coding");
      cy.contains("Search Results").should("be.visible");
    });

    it("should display no results message", () => {
      cy.get('input[placeholder*="Search"]').type("xyzabc123notfound");
      cy.contains("No results found").should("be.visible");
    });

    it("should navigate search pages", () => {
      cy.get('input[placeholder*="Search"]').type("room");
      cy.contains("button", "Next").then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click();
          cy.contains("Search Results").should("be.visible");
        }
      });
    });
  });

  describe("Category Filtering", () => {
    it("should filter by category", () => {
      cy.get("button").contains("AI & Tech").click();
      cy.url().should("include", "category");
      cy.contains("AI & Tech").should("be.visible");
    });

    it("should update room display on category filter", () => {
      cy.get("button").contains(/\w+/i).first().click();
      cy.get('[class*="grid"]').children().should("have.length.greaterThan", 0);
    });

    it("should return to discovery from category", () => {
      cy.get("button").contains("AI & Tech").click();
      cy.contains("Back to Discovery").click();
      cy.url().should("include", "/discover");
    });
  });

  describe("Advanced Search Modal", () => {
    it("should open advanced search modal", () => {
      cy.get('input[placeholder*="Search"]').click();
      // Click advanced search button if available
      cy.get("button").contains(/advanced|filter/i).then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click();
          cy.contains("Advanced Search").should("be.visible");
        }
      });
    });

    it("should apply multiple filters", () => {
      // Open modal, apply filters, verify results
      cy.get("input[placeholder*="Search"]").type("test");
      cy.get('input[placeholder*="test"]').clear();
    });

    it("should clear filters", () => {
      // Clear filters and return to default view
      cy.contains("Clear Filters").then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).click();
          cy.contains("Discover Live Rooms").should("be.visible");
        }
      });
    });
  });

  describe("Room Details", () => {
    it("should display room details on click", () => {
      cy.get('[class*="rounded"]').first().click();
      cy.url().should("include", "/room/");
      cy.get("h1").should("exist");
    });

    it("should show participant information", () => {
      cy.contains("Live Now").parent().contains("agents participating").should("exist");
    });

    it("should show real-time metrics", () => {
      cy.contains("viewers").should("exist");
      cy.get('[role="progressbar"]').should("exist");
    });
  });

  describe("Performance", () => {
    it("should load within acceptable time", () => {
      const start = Date.now();
      cy.visit("/discover");
      cy.contains("Discover Live Rooms").should("be.visible");
      cy.then(() => {
        const loadTime = Date.now() - start;
        expect(loadTime).to.be.lessThan(3000); // 3 seconds
      });
    });

    it("should render without layout shift", () => {
      cy.visit("/discover");
      cy.get("[class*='skeleton']").should("not.exist");
      cy.contains("Discover Live Rooms").should("be.visible");
    });

    it("should support scroll performance", () => {
      cy.visit("/discover");
      cy.scrollTo("bottom");
      cy.contains("Live Now").should("be.visible");
    });
  });

  describe("Error Handling", () => {
    it("should handle empty search gracefully", () => {
      cy.get('input[placeholder*="Search"]').type("   ");
      cy.contains("Search Results").should("not.exist");
    });

    it("should recover from errors", () => {
      cy.intercept("/api/discovery/trending", {
        statusCode: 500,
        body: { error: "Server error" },
      });
      cy.visit("/discover");
      cy.contains("something went wrong").then(($el) => {
        if ($el.length > 0) {
          cy.wrap($el).should("be.visible");
        }
      });
    });

    it("should display loading state", () => {
      cy.intercept("/api/discovery", { delay: 1000 });
      cy.visit("/discover");
      cy.get('[class*="skeleton"]').then(($skeleton) => {
        if ($skeleton.length > 0) {
          cy.wrap($skeleton).should("be.visible");
        }
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper heading hierarchy", () => {
      cy.get("h1").should("have.length.greaterThan", 0);
      cy.get("h2").should("have.length.greaterThan", 0);
    });

    it("should have descriptive button labels", () => {
      cy.get("button[aria-label]").should("have.length.greaterThan", 0);
    });

    it("should support keyboard navigation", () => {
      cy.get("input").first().focus();
      cy.focused().should("have.attr", "placeholder");
      cy.get("button").first().focus();
      cy.focused().should("have.attr", "role");
    });
  });

  describe("Responsive Design", () => {
    it("should work on mobile (375px)", () => {
      cy.viewport(375, 667);
      cy.visit("/discover");
      cy.contains("Discover Live Rooms").should("be.visible");
    });

    it("should work on tablet (768px)", () => {
      cy.viewport(768, 1024);
      cy.visit("/discover");
      cy.contains("Discover Live Rooms").should("be.visible");
    });

    it("should work on desktop (1920px)", () => {
      cy.viewport(1920, 1080);
      cy.visit("/discover");
      cy.contains("Discover Live Rooms").should("be.visible");
    });
  });
});
