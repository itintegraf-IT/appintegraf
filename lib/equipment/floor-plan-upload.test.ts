import { describe, expect, it } from "vitest";
import { FloorPlanUploadError, saveFloorPlanUpload } from "./floor-plan-upload";

describe("saveFloorPlanUpload", () => {
  it("odmítne HTML vydávané za PNG ještě před zápisem na disk", async () => {
    const file = new File(["<!doctype html><script>alert(1)</script>"], "plan.png", { type: "image/png" });
    await expect(saveFloorPlanUpload(1, file)).rejects.toBeInstanceOf(FloorPlanUploadError);
  });

  it("odmítne soubor nad 25 MB", async () => {
    const big = new Uint8Array(25 * 1024 * 1024 + 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([big], "plan.png", { type: "image/png" });
    await expect(saveFloorPlanUpload(1, file)).rejects.toThrow(/25 MB/);
  });
});
