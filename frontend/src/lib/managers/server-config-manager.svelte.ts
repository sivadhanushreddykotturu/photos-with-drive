import { getServerConfig, type ServerConfigDto } from '$lib/api/compat';

class ServerConfigManager {
  #value?: ServerConfigDto = $state();

  async init() {
    await this.loadServerConfig();
  }

  get value() {
    if (!this.#value) {
      throw new Error('Server config manager must be initialized first');
    }

    return this.#value;
  }

  async loadServerConfig() {
    this.#value = await getServerConfig();
  }
}

export const serverConfigManager = new ServerConfigManager();
