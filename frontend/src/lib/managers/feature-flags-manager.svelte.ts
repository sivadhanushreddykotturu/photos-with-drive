import { getServerFeatures, type ServerFeaturesDto } from '$lib/api/compat';

class FeatureFlagsManager {
  #value?: ServerFeaturesDto = $state();

  async init() {
    await this.#loadFeatureFlags();
  }

  get value() {
    if (!this.#value) {
      throw new Error('Feature flags manager must be initialized first');
    }

    return this.#value;
  }

  async #loadFeatureFlags() {
    this.#value = await getServerFeatures();
  }
}

export const featureFlagsManager = new FeatureFlagsManager();
