import * as vscode from 'vscode';
import { TestSuiteInfo, TestInfo, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent } from 'vscode-test-adapter-api';

const testSuite: TestSuiteInfo = {
	type: 'suite',
	id: 'root',
	label: 'QCumber',
	children: [
		{
			type: 'suite',
			id: 'nested',
			label: 'src/q/reporting/test/cube_function.quke',
			children: [
				{
					type: 'test',
					id: 'test1',
					label: 'count on an atom to return 1'
				},
				{
					type: 'test',
					id: 'test2',
					label: 'count of 1 drop list to return n - 1'
				}
			]
		},
		{
			type: 'test',
			id: 'test3',
			label: 'Test #3'
		},
		{
			type: 'test',
			id: 'test4',
			label: 'Test #4'
		}
	]
};

export function loadTests(): Promise<TestSuiteInfo> {
	const output = '[{"namespace":"src/q/building/test","fileName":"build.quke","feature":"","block":"Should","description":"","expectations":"","line":10,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.189472000","time":"0D00:00:00.000000000"},{"namespace":"src/q/building/test","fileName":"build.quke","feature":"","block":"Should","description":"","expectations":"","line":14,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.189573000","time":"0D00:00:00.000000000"},{"namespace":"src/q/building/test","fileName":"build.quke","feature":"","block":"Should","description":"","expectations":"","line":19,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.189798000","time":"0D00:00:00.000000000"},{"namespace":"src/q/core/tests","fileName":"core.quke","feature":"","block":"Should","description":"display number 1 and then 2","expectations":"","line":8,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.191197000","time":"0D00:00:00.000000000"},{"namespace":"src/q/core/tests","fileName":"core.quke","feature":"","block":"Should","description":"display number 1 and then 2","expectations":"","line":13,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.191300000","time":"0D00:00:00.000000000"},{"namespace":"src/q/core/tests","fileName":"core.quke","feature":"","block":"Should","description":"","expectations":"","line":19,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.191449000","time":"0D00:00:00.000000000"},{"namespace":"src/q/reporting/test","fileName":"cube_function.quke","feature":"Count","block":"Should","description":"return the count of its input","expectations":"count on an atom to return 1","line":5,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.192291000","time":"0D00:00:00.000000000"},{"namespace":"src/q/reporting/test","fileName":"cube_function.quke","feature":"Count","block":"Should","description":"return the count of its input","expectations":"count of 1 drop list to return n - 1","line":8,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.192359000","time":"0D00:00:00.000000000"},{"namespace":"src/q/reporting/test","fileName":"cube_latency.quke","feature":"// bench blocks must be wrapped in feature blocks","block":"Bench","description":"","expectations":"NA","line":5,"success":true,"result":{"baseline":"","behaviour":"","baselineError":"","behaviourError":"","passedBaseline":null,"passedTimeLimit":null,"passedLowerTolerance":null,"passedUpperTolerance":null,"timeBehaviour":null,"timeBaseline":null,"timelimit":null},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.193287000","time":""},{"namespace":"src/q/reporting/test","fileName":"cube_latency.quke","feature":"// bench blocks must be wrapped in feature blocks","block":"Bench","description":"// a feature may contain several bench blocks","expectations":"NA","line":10,"success":true,"result":{"baseline":"","behaviour":"","baselineError":"","behaviourError":"","passedBaseline":null,"passedTimeLimit":null,"passedLowerTolerance":null,"passedUpperTolerance":null,"timeBehaviour":null,"timeBaseline":null,"timelimit":100},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.193384000","time":""},{"namespace":"src/q/reporting/test","fileName":"cube_latency.quke","feature":"// bench blocks must be wrapped in feature blocks","block":"Bench","description":"may have a description","expectations":"NA","line":15,"success":true,"result":{"baseline":"","behaviour":"","baselineError":"","behaviourError":"","passedBaseline":null,"passedTimeLimit":null,"passedLowerTolerance":null,"passedUpperTolerance":null,"timeBehaviour":null,"timeBaseline":null,"timelimit":100},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.193508000","time":""}]';
	let rawTests = JSON.parse(output);
	//lets give each test an id
	rawTests.forEach((rawTest, index) => {
		rawTest.id = "test" + (index + 1);
		rawTest.type = "test";
		// I know explicitly adding spaces isn't good style
		rawTest.label = rawTest.fileName + " - Test " + (index + 1);
	});
	console.log('rawTests');
	console.log(rawTests);

	let rootTestSuite: TestSuiteInfo = {
		type: 'suite',
		id: 'root',
		label: 'QCumber',
		children: []
	  };

	var groupBy = function(array, key) {
		return array.reduce(function(r, x) {
			r[x[key]] = r[x[key]] || []; //don't understand this
			r[x[key]].push(x);
			return r
		}, {});
	};

	var moduleGroup = groupBy(rawTests, 'namespace');
	let moduleSuite: Array<{ type: string; id: string; label: string; children: Array; }> = [];
	Object.keys(moduleGroup).forEach(key => {
		let rawTests = moduleGroup[key];
		var fileGroup = groupBy(rawTests, 'fileName');
		//var fileGroupNames = Object.keys(fileGroup);
		let fileSuite: Array<{ type: string; id: string; label: string; children: Array; }> = [];
		Object.keys(fileGroup).forEach(key => {
			let tests = fileGroup[key];
			let testsForFile: Array<{ type: string; id: string; label: string; }> = [];
			tests.forEach(test => {
				const singleTest = (({ type, id, label }) => ({ type, id, label }))(test);
				testsForFile.push(singleTest);
			})
			var s = { type : 'suite', id : 'nested', label : key, children : testsForFile };
			fileSuite.push(s);
		});
		var s = { type : 'suite', id : 'nested', label : key, children : fileSuite };
		moduleSuite.push(s);
	};
	console.log(moduleSuite);
	rootTestSuite.children = moduleSuite;
	console.log('testSuite');
	console.log(rootTestSuite);

	let testSuite = rootTestSuite;
	//this.testSuite = testSuite;
	return Promise.resolve<TestSuiteInfo>(testSuite);
}


export async function runTests(
	tests: string[],
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {
	for (const suiteOrTestId of tests) {
		const node = findNode(testSuite, suiteOrTestId);
		if (node) {
			await runNode(node, testStatesEmitter);
		}
	}
}

function findNode(searchNode: TestSuiteInfo | TestInfo, id: string): TestSuiteInfo | TestInfo | undefined {
	if (searchNode.id === id) {
		return searchNode;
	} else if (searchNode.type === 'suite') {
		for (const child of searchNode.children) {
			const found = findNode(child, id);
			if (found) return found;
		}
	}
	return undefined;
}

async function runNode(
	node: TestSuiteInfo | TestInfo,
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {

	if (node.type === 'suite') {

		testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'running' });

		for (const child of node.children) {
			await runNode(child, testStatesEmitter);
		}

		testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'completed' });

	} else { // node.type === 'test'

		testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.id, state: 'running' });

		testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.id, state: 'passed' });

	}
}
