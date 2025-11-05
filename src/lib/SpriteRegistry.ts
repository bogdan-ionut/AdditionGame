// src/lib/SpriteRegistry.ts

export type SpriteAsset = {
  url: string;
  file: string;
  object: string;
  interest: string;
};

class SpriteRegistry {
  private assets: SpriteAsset[] = [];
  private deliveredFiles: Set<string> = new Set();

  add(asset: SpriteAsset) {
    if (this.deliveredFiles.has(asset.file)) {
      return;
    }
    this.assets.push(asset);
    this.deliveredFiles.add(asset.file);
  }

  byInterest(interest: string): SpriteAsset[] {
    return this.assets.filter((asset) => asset.interest === interest);
  }

  all(): SpriteAsset[] {
    return [...this.assets];
  }

  isDelivered(file: string): boolean {
    return this.deliveredFiles.has(file);
  }
}

export const spriteRegistry = new SpriteRegistry();
