"use strict";

const db = require("../db.js");
const { BadRequestError, NotFoundError } = require("../expressError");
const Company = require("./company.js");
const {
	commonBeforeAll,
	commonBeforeEach,
	commonAfterEach,
	commonAfterAll,
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** create */

describe("create", function () {
	const newCompany = {
		handle: "new",
		name: "New",
		description: "New Description",
		numEmployees: 1,
		logoUrl: "http://new.img",
	};

	test("works", async function () {
		let company = await Company.create(newCompany);
		expect(company).toEqual(newCompany);

		const result = await db.query(
			`SELECT handle, name, description, num_employees, logo_url
           FROM companies
           WHERE handle = 'new'`
		);
		expect(result.rows).toEqual([
			{
				handle: "new",
				name: "New",
				description: "New Description",
				num_employees: 1,
				logo_url: "http://new.img",
			},
		]);
	});

	test("bad request with dupe", async function () {
		try {
			await Company.create(newCompany);
			await Company.create(newCompany);
			fail();
		} catch (err) {
			expect(err instanceof BadRequestError).toBeTruthy();
		}
	});
});

/************************************** findAll */

describe("findAll", function () {
	test("works: no filter", async function () {
		let companies = await Company.findAll();
		expect(companies).toEqual([
			{
				handle: "c1",
				name: "C1",
				description: "Desc1",
				numEmployees: 1,
				logoUrl: "http://c1.img",
			},
			{
				handle: "c2",
				name: "C2",
				description: "Desc2",
				numEmployees: 2,
				logoUrl: "http://c2.img",
			},
			{
				handle: "c3",
				name: "C3",
				description: "Desc3",
				numEmployees: 3,
				logoUrl: "http://c3.img",
			},
		]);
	});
});

/************************************** findByFilter */

describe("findByFilter", function () {
	test("works: with all filters", async function () {
		const queries = {
			name: "C",
			minEmployees: 2,
			maxEmployees: 10,
		};

		let companies = await Company.findByFilter(queries);
		expect(companies).toEqual([
			{
				handle: "c2",
				name: "C2",
				description: "Desc2",
				numEmployees: 2,
				logoUrl: "http://c2.img",
			},
			{
				handle: "c3",
				name: "C3",
				description: "Desc3",
				numEmployees: 3,
				logoUrl: "http://c3.img",
			},
		]);
	});

	test("works: with name filter", async function () {
		const queries = {
			name: "2",
		};

		let companies = await Company.findByFilter(queries);
		expect(companies).toEqual([
			{
				handle: "c2",
				name: "C2",
				description: "Desc2",
				numEmployees: 2,
				logoUrl: "http://c2.img",
			},
		]);
	});

	test("works: with min/maxEmployees filters", async function () {
		const queries = {
			minEmployees: 1,
			maxEmployees: 2,
		};

		let companies = await Company.findByFilter(queries);
		expect(companies).toEqual([
			{
				handle: "c1",
				name: "C1",
				description: "Desc1",
				numEmployees: 1,
				logoUrl: "http://c1.img",
			},
			{
				handle: "c2",
				name: "C2",
				description: "Desc2",
				numEmployees: 2,
				logoUrl: "http://c2.img",
			},
		]);
	});

	test("fails: with invalid filter", async function () {
		const queries = {
			invalidquery: "taco",
		};

		try {
			await Company.findByFilter(queries);
			fail();
		} catch (err) {
			expect(err instanceof BadRequestError).toBeTruthy();
		}
	});

	test("fails: with invalid filter: min > max", async function () {
		const queries = {
			minEmployees: 10,
			maxEmployees: 2,
		};

		try {
			await Company.findByFilter(queries);
			fail();
		} catch (err) {
			expect(err instanceof BadRequestError).toBeTruthy();
		}
	});
});

/************************************** test Filter helper function */

describe("sql company filter search", function () {
	test("Pass: receiving correct whereClause and values", function () {
		const query = { name: "Apple", minEmployees: 4, maxEmployees: 100 };

		const { whereClause, values } = Company.sqlForCompanyFilterSearch(query);

		expect(whereClause).toEqual(
			`name ILIKE $1 AND num_employees >= $2 AND num_employees <= $3`
		);
		expect(values).toEqual(["%Apple%", 4, 100]);
	});

	test("Pass: works for only some queries", function () {
		const query = { name: "Apple", minEmployees: 4 };

		const { whereClause, values } = Company.sqlForCompanyFilterSearch(query);

		expect(whereClause).toEqual(`name ILIKE $1 AND num_employees >= $2`);
		expect(values).toEqual(["%Apple%", 4]);
	});

	test("Pass: works for queries in diff order", function () {
		const query = { minEmployees: 4, name: "Apple" };

		const { whereClause, values } = Company.sqlForCompanyFilterSearch(query);

		expect(whereClause).toEqual(`num_employees >= $1 AND name ILIKE $2`);
		expect(values).toEqual([4, "%Apple%"]);
	});

	test("Fail: when minEmployees > maxEmployees", function () {
		const query = { minEmployees: 20, maxEmployees: 5 };

		expect(() => Company.sqlForCompanyFilterSearch(query)).toThrow(
			BadRequestError
		);
	});

	test("Fail: when query is invalid", function () {
		const query = { companyAge: 20, maxEmployees: 5 };

		expect(() => Company.sqlForCompanyFilterSearch(query)).toThrow(
			BadRequestError
		);
	});
});

/************************************** get */

describe("get", function () {
	test("works", async function () {
		let company = await Company.get("c1");
		expect(company).toEqual({
			handle: "c1",
			name: "C1",
			description: "Desc1",
			numEmployees: 1,
			logoUrl: "http://c1.img",
			jobs: [
				{
					id: expect.any(Number),
					title: "j1",
					salary: 1,
					equity: "0.01",
					companyHandle: "c1",
				},
			],
		});
	});

	test("not found if no such company", async function () {
		try {
			await Company.get("nope");
			fail();
		} catch (err) {
			expect(err instanceof NotFoundError).toBeTruthy();
		}
	});
});

/************************************** update */

describe("update", function () {
	const updateData = {
		name: "New",
		description: "New Description",
		numEmployees: 10,
		logoUrl: "http://new.img",
	};

	test("works", async function () {
		let company = await Company.update("c1", updateData);
		expect(company).toEqual({
			handle: "c1",
			...updateData,
		});

		const result = await db.query(
			`SELECT handle, name, description, num_employees, logo_url
           FROM companies
           WHERE handle = 'c1'`
		);
		expect(result.rows).toEqual([
			{
				handle: "c1",
				name: "New",
				description: "New Description",
				num_employees: 10,
				logo_url: "http://new.img",
			},
		]);
	});

	test("works: null fields", async function () {
		const updateDataSetNulls = {
			name: "New",
			description: "New Description",
			numEmployees: null,
			logoUrl: null,
		};

		let company = await Company.update("c1", updateDataSetNulls);
		expect(company).toEqual({
			handle: "c1",
			...updateDataSetNulls,
		});

		const result = await db.query(
			`SELECT handle, name, description, num_employees, logo_url
           FROM companies
           WHERE handle = 'c1'`
		);
		expect(result.rows).toEqual([
			{
				handle: "c1",
				name: "New",
				description: "New Description",
				num_employees: null,
				logo_url: null,
			},
		]);
	});

	test("not found if no such company", async function () {
		try {
			await Company.update("nope", updateData);
			fail();
		} catch (err) {
			expect(err instanceof NotFoundError).toBeTruthy();
		}
	});

	test("bad request with no data", async function () {
		try {
			await Company.update("c1", {});
			fail();
		} catch (err) {
			expect(err instanceof BadRequestError).toBeTruthy();
		}
	});
});

/************************************** remove */

describe("remove", function () {
	test("works", async function () {
		await Company.remove("c1");
		const res = await db.query(
			"SELECT handle FROM companies WHERE handle='c1'"
		);
		expect(res.rows.length).toEqual(0);
	});

	test("not found if no such company", async function () {
		try {
			await Company.remove("nope");
			fail();
		} catch (err) {
			expect(err instanceof NotFoundError).toBeTruthy();
		}
	});
});
