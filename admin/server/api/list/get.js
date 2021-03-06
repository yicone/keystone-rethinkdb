var async = require('async');
var assign = require('object-assign');
var listToArray = require('list-to-array');

module.exports = function (req, res) {
	// var where = {};
	var fields = req.query.fields;
	var includeCount = req.query.count !== 'false';
	var includeResults = req.query.results !== 'false';
	if (includeResults && fields) {
		if (fields === 'false') {
			fields = false;
		}
		if (typeof fields === 'string') {
			fields = listToArray(fields);
		}
		if (fields && !Array.isArray(fields)) {
			return res.status(401).json({ error: 'fields must be undefined, a string, or an array' });
		}
	}
	// convert model to query
	var query = req.list.model.filter({});
	var filters = req.query.filters;
	if (filters && typeof filters === 'string') {
		try { filters = JSON.parse(req.query.filters); }
		catch (e) { } // eslint-disable-line no-empty
	}
	if (typeof filters === 'object') {
		// assign(where, req.list.addFiltersToQuery(filters));
		let predictions = req.list.addFiltersToQuery2(filters);
		predictions.forEach(prediction => {
			query = query.filter(prediction);
		});
	}
	if (req.query.search) {
		// assign(where, req.list.addSearchToQuery(req.query.search));
		let prediction = req.list.addSearchToQuery2(req.query.search);
		query = query.filter(prediction);
	}
	// var query = req.list.model.find(where);

	if (req.query.populate) {
		query.populate(req.query.populate);
	}
	if (req.query.expandRelationshipFields && req.query.expandRelationshipFields !== 'false') {
		req.list.relationshipFields.forEach(function (i) {
			// query.populate(i.path);
			var ref = i.thinkyRelation.fieldName;
			var modelToGet = {};
			modelToGet[ref] = true;
			query = query.getJoin(modelToGet);
		});
	}
	var sort = req.list.expandSort(req.query.sort);
	async.waterfall([
		function (next) {
			if (!includeCount) {
				return next(null, 0);
			}
			query._count(next);
		},
		function (count, next) {
			if (!includeResults) {
				return next(null, count, []);
			}
			// query.find();
			if (sort.string) {
				query = query.sort(sort.string);
			}
			query = query.skip(Number(req.query.skip) || 0);
			query = query.limit(Number(req.query.limit) || 100);
			// query.exec(function (err, items) {
			// 	next(err, count, items);
			// });
			// 因为 thinky.query.exec 已被实现为 run() -> Promise，此处需要 run(cb) -> void
			query.run().then(items => {
				next(null, count, items);
			}).error(err => {
				if (err) {
					next(err);
				}
			});
		},
	], function (err, count, items) {
		if (err) {
			res.logError('admin/server/api/list/get', 'database error finding items', err);
			return res.apiError('database error', err);
		}

		return res.json({
			results: includeResults
				? items.map(function (item) {
					return req.list.getData(item, fields, req.query.expandRelationshipFields);
				})
				: undefined,
			count: includeCount
				? count
				: undefined,
		});
	});
};
