import * as Hapi from "hapi";
import { IDatabase } from "../database/database";
import { IHyperledgerConfiguration, IServerConfigurations } from "../configurations";
import { LoggerInstance } from 'winston';
import * as Boom from 'boom';
import { ComposerConnection } from '../composer/composer-connection';
import { ComposerModel, ComposerTypes } from '../composer/composer-model';
import ComposerConnectionManager from '../composer/composer-connection-manager';

export default class MemberController {

  /**
   * Constructor
   * @param {IServerConfigurations} configs
   * @param {IDatabase} database
   * @param {IHyperledgerConfiguration} hyperledger
   * @param {winston.LoggerInstance} logger
   * @param {ComposerConnection} composerConnection
   */
    constructor(
       private configs: IServerConfigurations,
       private database: IDatabase,
       private hyperledger: IHyperledgerConfiguration,
       private logger: LoggerInstance,
       private connectionManager: ComposerConnectionManager
    ) {
    }

    /**
     * API route: Get list
     * query param: resolve
     * if set to true the composer data is resolved
     * if set to false or not provided the data is not resolved
     * The difference between resolved and not resolved is that linked resources,foreign keys, will be completed resolved
     * and converted to an object
     * @param {Request} request
     * @param {ReplyNoContinue} reply
     * @returns {Promise<void>}
     */
    async getList(request: Hapi.Request, reply: Hapi.ReplyNoContinue): Promise<Hapi.Response> {
      // Get credentials from token, the token is the member email address
      const identity = request.auth.credentials.id;
      const resolve = request.query["resolve"] === "true" ? true : false;

      try {
        const composerConnection = await this.connectionManager.createBusinessNetworkConnection(identity);
        const registry = await composerConnection.getRegistry(ComposerTypes.Member);

        if (resolve) {
          // If we resolve the data the returned data is valid json data and can be send as such
          return registry.resolveAll()
          .then((data) => {
            return composerConnection.disconnect().then(() => reply(data));
          });
        } else {
          // unresolved data is not valid json and cannot directly be returned through Hapi. We need to use the serializer
          return registry.getAll()
          .then((members) => {
            let serialized = members.map((member) => composerConnection.serializeToJSON(member));
            return composerConnection.disconnect().then(() => reply(serialized));
          });
        }
      } catch (error) {
        reply(Boom.badImplementation(error));
      }
    }


  /**
   * API route: Get list by query
   * @param {Request} request
   * @param {ReplyNoContinue} reply
   * @returns {Promise<void>}
   */
  async getListByQuery(request: Hapi.Request, reply: Hapi.ReplyNoContinue): Promise<Hapi.Response> {
    // Get credentials from token, the token is the member email address
    const identity = request.auth.credentials.id;
    try {
      const composerConnection = await this.connectionManager.createBusinessNetworkConnection(identity);
      return composerConnection.query(ComposerModel.QUERY.SELECT_ALL_MEMBERS)
        .then((members) => {
          let serialized = members.map((member) => composerConnection.serializeToJSON(member));
          return composerConnection.disconnect().then(() => reply(serialized));
        });
    } catch (error) {
      reply(Boom.badImplementation(error));
    }
  }


  /**
   * API route: create a new member
   * @param {Request} request
   * @param {ReplyNoContinue} reply
   * @returns {Promise<Response>}
   */
  async create(request: Hapi.Request, reply: Hapi.ReplyNoContinue): Promise<Hapi.Response> {
    let payload: any = request.payload;
    const identity = request.auth.credentials.id;
    try {
      const composerConnection = await this.connectionManager.createBusinessNetworkConnection(identity);

      // check if the entity has already been registered or not
      const registry = await composerConnection.getRegistry(ComposerTypes.Member);
      const exists = await registry.exists(payload.id);
      if (exists) {
        await composerConnection.disconnect();
        return reply(Boom.badRequest(`member already exists`));
      } else {
        await registry.add(composerConnection.composerModelFactory.createMember(payload));

        // Create passport for the member(user) so he or she can login with username/password
        // dev-only: remove if already exists
        let passport = await this.database.passportModel.findOne({email: payload.email}).lean(true);
        if (passport) {
          await this.database.passportModel.remove({email: payload.email});
        }

        // create new passport
        passport = {
          email: payload.email,
          firstName: payload.firstName,
          lastName: payload.lastName,
          password: payload.password //"test" // setting password to test for dev
        };

        await this.database.passportModel.create(passport);

        // issue a new identity by composer-client
        const identity = await composerConnection.bizNetworkConnection.issueIdentity(
          composerConnection.composerModelFactory.getNamespaceForResource(ComposerTypes.Member, payload.id),
          payload.email
        );

        // import new Id card
        await this.connectionManager.importNewIdCard(identity.userID, identity.userSecret);

        await composerConnection.disconnect();

        return reply(payload).code(201);
      }
    } catch (error) {
      return reply(Boom.badImplementation(error));
    }
  }

  /**
   * API route: Get member by Id
   * query param: resolve
   * if set to true the composer data is resolved
   * @param {Request} request
   * @param {ReplyNoContinue} reply
   * @returns {Promise<void>}
   */
  async getById(request: Hapi.Request, reply: Hapi.ReplyNoContinue): Promise<Hapi.Response> {
    const identity = request.auth.credentials.id;
    const id = request.params["id"];
    const resolve = request.query["resolve"] === "true" ? true : false;

    try {
      const composerConnection = await this.connectionManager.createBusinessNetworkConnection(identity);
      const registry = await composerConnection.getRegistry(ComposerTypes.Member);
      return registry.exists(id)
        .then((exists) => {
          if (exists) {
            if (resolve) {
              registry.resolve(id)
                .then((member) => {
                  return composerConnection.disconnect().then(() => reply(member));
                });
            } else {
              registry.get(id)
                .then((member) => {
                  const output = composerConnection.serializeToJSON(member);
                  return composerConnection.disconnect().then(() => reply(output));
                });
            }
          } else {
            return composerConnection.disconnect().then(() => reply(Boom.notFound()));
          }
        });
    } catch (error) {
      reply(Boom.badImplementation(error));
    }
  }

  /**
   * API route: Delete a member
   * When we delete a member we also want to remove the passport and the composer identity
   * @param {Request} request
   * @param {ReplyNoContinue} reply
   * @returns {Promise<Response>}
   */
  async delete(request: Hapi.Request, reply: Hapi.ReplyNoContinue): Promise<Hapi.Response> {
    let id = request.params["id"];
    const identity = request.auth.credentials.id;
    try {
      const composerConnection = await this.connectionManager.createBusinessNetworkConnection(identity);
      const registry = await composerConnection.getRegistry(ComposerTypes.Member);

      await this.database.passportModel.remove({ email: id});

      return registry.exists(id)
        .then((exists) => {
          if (exists) {
            return registry.get(id).then((member) => {
              return composerConnection.getIdentity(member.email)
                .then((identity) => composerConnection.revokeIdentity(identity))
                .then(() => registry.remove(id))
                .then(() => composerConnection.disconnect())
                .then(() => reply({id}));
            });
          } else {
            return composerConnection.disconnect().then(() => reply(Boom.notFound()));
          }
        });
    } catch (error) {
      return reply(Boom.badImplementation(error));
    }
  }

  /**
   * API route: Update a member
   * @param {Request} request
   * @param {ReplyNoContinue} reply
   * @returns {Promise<Response>}
   */
  async update(request: Hapi.Request, reply: Hapi.ReplyNoContinue): Promise<Hapi.Response> {
    const identity = request.auth.credentials.id;
    let id = request.params["id"];
    const payload: any = request.payload;
    try {
      const composerConnection = await this.connectionManager.createBusinessNetworkConnection(identity);
      const registry = await composerConnection.getRegistry(ComposerTypes.Member);

      const exists =  registry.exists(id);
      if (exists) {
        let composerEntityForUpdate = await registry.get(id);

        composerEntityForUpdate = composerConnection.composerModelFactory.editMember(composerEntityForUpdate, payload);
        return registry.update(composerEntityForUpdate).then(() => {
          const output = composerConnection.serializeToJSON(composerEntityForUpdate);
          return composerConnection.disconnect().then(() => {
            return reply(output);
          });
        });
      } else {
        await  composerConnection.disconnect();
        return reply(Boom.notFound());
      }
    } catch (error) {
      return reply(Boom.badImplementation(error));
    }
  }


  /**
   * API route: Get all documents for the member by query
   * @param {Request} request
   * @param {ReplyNoContinue} reply
   * @returns {Promise<void>}
   */
  async getAllDocumentsForMemberByQuery(request: Hapi.Request, reply: Hapi.ReplyNoContinue): Promise<Hapi.Response> {
    // Get credentials from token, the token is the member email address
    const identity = request.auth.credentials.id;
    let id = request.params["id"];
    try {
      const composerConnection = await this.connectionManager.createBusinessNetworkConnection(identity);
      const registry = await composerConnection.getRegistry(ComposerTypes.Member);

      // The query parameters for composer queries need to be converted to the resource namespace if filtering on resources

      const queryParam = composerConnection.composerModelFactory.getNamespaceForResource(ComposerTypes.Documents, id);
      return composerConnection.query(ComposerModel.QUERY.SELECT_ALL_DOCUMENTS_BY_MEMBERS, { member: queryParam})
        .then((members) => {
          let serialized = members.map((member) => composerConnection.serializeToJSON(member));
          return composerConnection.disconnect().then(() => reply(serialized));
        });
    } catch (error) {
      reply(Boom.badImplementation(error));
    }
  }
  /**
   * API route: Get all keys for the member by query
   * @param {Request} request
   * @param {ReplyNoContinue} reply
   * @returns {Promise<void>}
   */
  async getAllKeysForMemberByQuery(request: Hapi.Request, reply: Hapi.ReplyNoContinue): Promise<Hapi.Response> {
    // Get credentials from token, the token is the member email address
    const identity = request.auth.credentials.id;
    let id = request.params["id"];
    try {
      const composerConnection = await this.connectionManager.createBusinessNetworkConnection(identity);
      const registry = await composerConnection.getRegistry(ComposerTypes.Member);

      // The query parameters for composer queries need to be converted to the resource namespace if filtering on resources

      const queryParam = composerConnection.composerModelFactory.getNamespaceForResource(ComposerTypes.Keys, id);
      return composerConnection.query(ComposerModel.QUERY.SELECT_ALL_KEYS_BY_MEMBERS, { member: queryParam})
        .then((members) => {
          let serialized = members.map((member) => composerConnection.serializeToJSON(member));
          return composerConnection.disconnect().then(() => reply(serialized));
        });
    } catch (error) {
      reply(Boom.badImplementation(error));
    }
  }
}
