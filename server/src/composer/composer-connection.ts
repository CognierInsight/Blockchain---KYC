import { BusinessNetworkConnection } from 'composer-client';
import { ComposerModelFactory } from './composer-model-factory';
import { ComposerModel, ComposerTypes } from './composer-model';

export class ComposerConnection {

  /**
   * Constructor
   * @param {BusinessNetworkConnection} bizNetworkConnection
   * @param businessNetworkDefinition
   * @param {ComposerModelFactory} composerModelFactory
   */
  constructor(
    public bizNetworkConnection: BusinessNetworkConnection,
    public businessNetworkDefinition: any,
    public composerModelFactory: ComposerModelFactory
    ) {
  }

  /**
   * Convert hyperledger composer ledger data to a usable json object
   * @param object
   * @returns {any}
   */
  serializeToJSON(object: any): any {
    return this.businessNetworkDefinition.getSerializer().toJSON(object);
  }

  /**
   * Convert JSON string to hyperledger composer ledger data
   * @param object
   * @param object
   * @returns {any}
   */
  serializeFromJSONObject(jsonObject: any): any {
    return this.businessNetworkDefinition.getSerializer().fromJSON(jsonObject);
  }

  /**
   * Get asset or participant registry based on composer type
   * @param {ComposerTypes} composerType
   * @returns {any}
   */
  getRegistry(composerType: ComposerTypes) {
    switch (composerType) {
      case ComposerTypes.Member:
        return this.bizNetworkConnection.getParticipantRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.PARTICIPANT.MEMBER}`);
      case ComposerTypes.Documents:
        return this.bizNetworkConnection.getAssetRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.ASSET.DOCUMENTS}`);
      case ComposerTypes.Keys:
        return this.bizNetworkConnection.getAssetRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.ASSET.KEYS}`);
      case ComposerTypes.Category:
        return this.bizNetworkConnection.getAssetRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.ASSET.CATEGORY}`);
      case ComposerTypes.CreateKey:
        return this.bizNetworkConnection.getTransactionRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.TRANSACTION.CREATE_KEY}`);
      case ComposerTypes.RevokeKeyAccess:
        return this.bizNetworkConnection.getTransactionRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.TRANSACTION.REVOKE_KEY_ACCESS}`);
      case ComposerTypes.Search:
        return this.bizNetworkConnection.getTransactionRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.TRANSACTION.SEARCH_KEY}`);
      case ComposerTypes.MemberTransaction:
        return this.bizNetworkConnection.getTransactionRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.TRANSACTION.MEMBER_TRANSACTION}`);
      case ComposerTypes.KeyTransaction:
        return this.bizNetworkConnection.getTransactionRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.TRANSACTION.KEY_TRANSACTION}`);
      // case ComposerTypes.Driver:
      //   return this.bizNetworkConnection.getParticipantRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.PARTICIPANT.DRIVER}`);
      // case ComposerTypes.Truck:
      //   return this.bizNetworkConnection.getAssetRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.ASSET.TRUCK}`);
      // case ComposerTypes.Cargo:
      //   return this.bizNetworkConnection.getAssetRegistry(`${ComposerModel.NAMESPACE}.${ComposerModel.ASSET.CARGO}`);
      default:
        throw new Error(`composer connection getRegistery has not been defined yet`);
    }
  }

  /**
   * Execute a Hyperledger Composer query
   * @param {string} name
   * @param params
   * @returns {any}
   */
  query(name: string, params: any = {}) {
    return this.bizNetworkConnection.query(name, params);
  }

  /**
   * Execute a Hyperledger Composer Transaction
   * @param {string} resource
   * @returns {any}
   */
  submitTransaction(resource: string) {
    return this.bizNetworkConnection.submitTransaction(resource);
  }

  /**
   * Disconnect business network connection
   * @returns {Promise<void>}
   */
  disconnect(): Promise<void> {
    return this.bizNetworkConnection.disconnect();
  }

  /**
   * Get composer identity
   * @param {string} identityName
   * @returns {Promise<any>}
   */
  getIdentity(identityName: string): Promise<any> {
    return this.bizNetworkConnection.getIdentityRegistry()
      .then((identityRegistry) => identityRegistry.getAll())
      .then((identities) => {
        let id = null;
        for (let i = 0; i < identities.length; i++) {
          if (identityName === identities[i].name) {
            id = identities[i];
            break;
          }
        }
        return id;
      });
  }

  /**
   * Revoke composer identity
   * @param identity
   * @returns {Promise<void>}
   */
  revokeIdentity(identity: any): Promise<void> {
    return this.bizNetworkConnection.revokeIdentity(identity);
  }
}
