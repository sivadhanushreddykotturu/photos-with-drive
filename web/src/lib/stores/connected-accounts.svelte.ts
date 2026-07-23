import * as accountsApi from '$lib/api/accounts';
import type { ConnectedAccount } from '$lib/api/types';

/**
 * Shared cache of the user's connected Drive accounts so upload affordances
 * can be gated before the user wastes a pick/drop on a guaranteed failure.
 */
class ConnectedAccountsStore {
  accounts = $state<ConnectedAccount[] | undefined>();
  #loading: Promise<ConnectedAccount[]> | undefined;

  get hasAccounts() {
    return (this.accounts?.length ?? 0) > 0;
  }

  async load(force = false): Promise<ConnectedAccount[]> {
    if (this.accounts && !force) {
      return this.accounts;
    }
    this.#loading ??= accountsApi
      .listConnectedAccounts()
      .then((accounts) => {
        this.accounts = accounts;
        return accounts;
      })
      .catch(() => {
        this.accounts = [];
        return [];
      })
      .finally(() => {
        this.#loading = undefined;
      });
    return this.#loading;
  }
}

export const connectedAccountsStore = new ConnectedAccountsStore();
