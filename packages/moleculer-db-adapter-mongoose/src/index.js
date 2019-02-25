/*
 * moleculer-db-adapter-mongoose
 * Copyright (c) 2017 MoleculerJS (https://github.com/moleculerjs/moleculer-db)
 * MIT Licensed
 */

"use strict";

const _ 		= require("lodash");
const Promise	= require("bluebird");
const mongoose  = require("mongoose");

class MongooseDbAdapter {

	/**
	 * Creates an instance of MongooseDbAdapter.
	 * @param {String} uri
	 * @param {Object?} opts
	 *
	 * @memberof MongooseDbAdapter
	 */
	constructor(uri, opts) {
		this.uri = uri,
		this.opts = opts;
		mongoose.Promise = Promise;
	}

	/**
	 * Initialize adapter
	 *
	 * @param {ServiceBroker} broker
	 * @param {Service} service
	 *
	 * @memberof MongooseDbAdapter
	 */
	init(broker, service) {
		this.broker = broker;
		this.service = service;

		if (this.service.schema.model) {
			this.model = this.service.schema.model;
		} else if (this.service.schema.schema) {
			if (!this.service.schema.modelName) {
				throw new Error("`modelName` is required when `schema` is given in schema of service!");
			}
			this.schema = this.service.schema.schema;
			this.modelName = this.service.schema.modelName;
		}

		if (!this.model && !this.schema) {
			/* istanbul ignore next */
			throw new Error("Missing `model` or `schema` definition in schema of service!");
		}
	}

	/**
	 * Connect to database
	 *
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	connect() {
		let conn;

		if (this.model) {
			/* istanbul ignore next */
			if (mongoose.connection.readyState != 0) {
				this.db = mongoose.connection;
				return Promise.resolve();
			}

			conn = mongoose.connect(this.uri, this.opts);
		} else if (this.schema) {
			conn = mongoose.createConnection(this.uri, this.opts);
			this.model = conn.model(this.modelName, this.schema);
		}

		return conn.then(result => {
			this.db = result.connection || result.db;

			this.db.on("disconnected", function mongoDisconnected() {
				/* istanbul ignore next */
				this.service.logger.warn("Disconnected from MongoDB.");
			}.bind(this));
		});
	}

	/**
	 * Disconnect from database
	 *
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	disconnect() {
		if (this.db) {
			this.db.close();
		}
		return Promise.resolve();
	}

	/**
	 * Find all entities by filters.
	 *
	 * Available filter props:
	 * 	- limit
	 *  - offset
	 *  - sort
	 *  - search
	 *  - searchFields
	 *  - query
	 *
	 * @param {any} filters
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	find(filters) {
		return this.createCursor(filters).exec();
	}

	/**
	 * Find an entity by query
	 *
	 * @param {Object} query
	 * @returns {Promise}
	 * @memberof MemoryDbAdapter
	 */
	findOne(query) {
		return this.model.findOne(query).exec();
	}

	/**
	 * Find an entities by ID
	 *
	 * @param {any} _id
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	findById(_id) {
		return this.model.findById(_id).exec();
	}

	/**
	 * Find any entities by IDs
	 *
	 * @param {Array} idList
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	findByIds(idList) {
		return this.model.find({
			_id: {
				$in: idList
			}
		}).exec();
	}

	/**
	 * Get count of filtered entites
	 *
	 * Available filter props:
	 *  - search
	 *  - searchFields
	 *  - query
	 *
	 * @param {Object} [filters={}]
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	count(filters = {}) {
		return this.createCursor(filters).count().exec();
	}

	/**
	 * Insert an entity
	 *
	 * @param {Object} entity
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	insert(entity) {
		const item = new this.model(entity);
		return item.save();
	}

	/**
	 * Insert many entities
	 *
	 * @param {Array} entities
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	insertMany(entities) {
		return this.model.create(entities);
	}

	/**
	 * Update many entities by `query` and `update`
	 *
	 * @param {Object} query
	 * @param {Object} update
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	updateMany(query, update) {
		return this.model.updateMany(query, update, { multi: true, "new": true }).then(res => res.n);
	}

	/**
	 * Update an entity by ID and `update`
	 *
	 * @param {any} _id
	 * @param {Object} update
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	updateById(_id, update) {
		return this.model.findByIdAndUpdate(_id, update, { "new": true });
	}

	/**
	 * Remove entities which are matched by `query`
	 *
	 * @param {Object} query
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	removeMany(query) {
		return this.model.deleteMany(query).then(res => res.n);
	}

	/**
	 * Remove an entity by ID
	 *
	 * @param {any} _id
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	removeById(_id) {
		return this.model.findByIdAndRemove(_id);
	}

	/**
	 * Clear all entities from collection
	 *
	 * @returns {Promise}
	 *
	 * @memberof MongooseDbAdapter
	 */
	clear() {
		return this.model.deleteMany({}).then(res => res.n);
	}

	/**
	 * Convert DB entity to JSON object
	 *
	 * @param {any} entity
	 * @returns {Object}
	 * @memberof MongooseDbAdapter
	 */
	entityToObject(entity) {
		let json = entity.toJSON();
		if (entity._id && entity._id.toHexString) {
			json._id = entity._id.toHexString();
		} else if (entity._id && entity._id.toString) {
			json._id = entity._id.toString();
		}
		return json;
	}

	/**
	 * Create a filtered query
	 * Available filters in `params`:
	 *  - search
	 * 	- sort
	 * 	- limit
	 * 	- offset
	 *  - query
	 *
 	 * @param {Object} params
	 * @returns {MongoQuery}
	 */
	createCursor(params) {
		if (params) {
			const q = this.model.find(params.query);
			// Full-text search
			// More info: https://docs.mongodb.com/manual/reference/operator/query/text/
			if (_.isString(params.search) && params.search !== "") {
				q.find({
					$text: {
						$search: params.search
					}
				});
				q._fields = {
					_score: {
						$meta: "textScore"
					}
				};
				q.sort({
					_score: {
						$meta: "textScore"
					}
				});
			} else {
				// Sort
				if (_.isString(params.sort))
					q.sort(params.sort.replace(/,/, " "));
				else if (Array.isArray(params.sort))
					q.sort(params.sort.join(" "));
			}

			// Offset
			if (_.isNumber(params.offset) && params.offset > 0)
				q.skip(params.offset);

			// Limit
			if (_.isNumber(params.limit) && params.limit > 0)
				q.limit(params.limit);

			return q;
		}
		return this.model.find();
	}

	/**
	* Transforms 'idField' into MongoDB's '_id'
	* @param {Object} entity 
	* @param {String} idField 
	* @memberof MongoDbAdapter
	* @returns {Object} Modified entity
	*/
	beforeSaveTransformID (entity, idField) {
		let newEntity = _.cloneDeep(entity);

		if (idField !== "_id" && entity[idField] !== undefined) {
			newEntity._id = this.stringToObjectID(newEntity[idField]);
			delete newEntity[idField];
		}

		return newEntity;
	}

	/**
	* Transforms MongoDB's '_id' into user defined 'idField'
	* @param {Object} entity 
	* @param {String} idField 
	* @memberof MongoDbAdapter
	* @returns {Object} Modified entity
	*/
	afterRetrieveTransformID (entity, idField) {
		if (idField !== "_id") {
			entity[idField] = this.objectIDToString(entity["_id"]);
			delete entity._id;
		} 
		return entity;
	}
	
	stringToObjectID(str) {
	
		return mongoose.Types.ObjectId(str);
	}
	
	objectIDToString(objectId) {
		
		return objectId.toString();
	}
}

module.exports = MongooseDbAdapter;
