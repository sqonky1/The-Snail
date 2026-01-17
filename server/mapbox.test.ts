import { describe, expect, it } from "vitest";

describe("Mapbox Token Validation", () => {
  it("should have a valid Mapbox token configured", async () => {
    const token = process.env.VITE_MAPBOX_TOKEN;
    
    expect(token).toBeDefined();
    expect(token).toMatch(/^pk\./);
    
    // Validate token by making a request to Mapbox API
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/singapore.json?access_token=${token}`
    );
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.features).toBeDefined();
    expect(data.features.length).toBeGreaterThan(0);
  });
});
