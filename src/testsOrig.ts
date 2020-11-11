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

export function getTestDirectory(): string {
    let directory: string = (vscode.workspace.getConfiguration('qcumberExplorer', null).get('directory') as string);
    return directory || '/src/q/';
  };

export function loadTests(): Promise<TestSuiteInfo> {
	//TODO retrieve this output from build/q/SERVICE/qcumberInit.json
	//Sort of complicated, each service will run qcumber and therefore each will generate a json of results
	//The jsons from each service should be parsed into an array of jsons, with the service as the key
	//The runTests command would then take the service key and know to run the qcumber script against that particular service.
	//Two services might share modules, and therefore we may be repeating tests, but maybe that is ok -
	// as services need to check that each module works for them
	//I will need to add logic to each service's Dockerfile defining what modules are necessary for each service
	//This way I prevent q-views for example running q-builder tests which will fail probably due to lack of data
	//const output = '[{"namespace":"src/q/building/test","fileName":"build.quke","feature":"","block":"Should","description":"","expectations":"","line":10,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.189472000","time":"0D00:00:00.000000000"},{"namespace":"src/q/building/test","fileName":"build.quke","feature":"","block":"Should","description":"","expectations":"","line":14,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.189573000","time":"0D00:00:00.000000000"},{"namespace":"src/q/building/test","fileName":"build.quke","feature":"","block":"Should","description":"","expectations":"","line":19,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.189798000","time":"0D00:00:00.000000000"},{"namespace":"src/q/core/tests","fileName":"core.quke","feature":"","block":"Should","description":"display number 1 and then 2","expectations":"","line":8,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.191197000","time":"0D00:00:00.000000000"},{"namespace":"src/q/core/tests","fileName":"core.quke","feature":"","block":"Should","description":"display number 1 and then 2","expectations":"","line":13,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.191300000","time":"0D00:00:00.000000000"},{"namespace":"src/q/core/tests","fileName":"core.quke","feature":"","block":"Should","description":"","expectations":"","line":19,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.191449000","time":"0D00:00:00.000000000"},{"namespace":"src/q/reporting/test","fileName":"cube_function.quke","feature":"Count","block":"Should","description":"return the count of its input","expectations":"count on an atom to return 1","line":5,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.192291000","time":"0D00:00:00.000000000"},{"namespace":"src/q/reporting/test","fileName":"cube_function.quke","feature":"Count","block":"Should","description":"return the count of its input","expectations":"count of 1 drop list to return n - 1","line":8,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.192359000","time":"0D00:00:00.000000000"},{"namespace":"src/q/reporting/test","fileName":"cube_latency.quke","feature":"// bench blocks must be wrapped in feature blocks","block":"Bench","description":"","expectations":"NA","line":5,"success":true,"result":{"baseline":"","behaviour":"","baselineError":"","behaviourError":"","passedBaseline":null,"passedTimeLimit":null,"passedLowerTolerance":null,"passedUpperTolerance":null,"timeBehaviour":null,"timeBaseline":null,"timelimit":null},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.193287000","time":""},{"namespace":"src/q/reporting/test","fileName":"cube_latency.quke","feature":"// bench blocks must be wrapped in feature blocks","block":"Bench","description":"// a feature may contain several bench blocks","expectations":"NA","line":10,"success":true,"result":{"baseline":"","behaviour":"","baselineError":"","behaviourError":"","passedBaseline":null,"passedTimeLimit":null,"passedLowerTolerance":null,"passedUpperTolerance":null,"timeBehaviour":null,"timeBaseline":null,"timelimit":100},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.193384000","time":""},{"namespace":"src/q/reporting/test","fileName":"cube_latency.quke","feature":"// bench blocks must be wrapped in feature blocks","block":"Bench","description":"may have a description","expectations":"NA","line":15,"success":true,"result":{"baseline":"","behaviour":"","baselineError":"","behaviourError":"","passedBaseline":null,"passedTimeLimit":null,"passedLowerTolerance":null,"passedUpperTolerance":null,"timeBehaviour":null,"timeBaseline":null,"timelimit":100},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-04T21:26:32.193508000","time":""}]';
	const output = '[{"namespace":"src/q/building/test","fileName":"build.quke","feature":"","block":"Should","description":"","expectations":"","line":10,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-10T23:44:02.875721000","time":"0D00:00:00.000000000"},{"namespace":"src/q/building/test","fileName":"build.quke","feature":"","block":"Should","description":"","expectations":"","line":14,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-10T23:44:02.875758000","time":"0D00:00:00.000000000"},{"namespace":"src/q/building/test","fileName":"build.quke","feature":"","block":"Should","description":"","expectations":"","line":19,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-10T23:44:02.875843000","time":"0D00:00:00.000000000"},{"namespace":"src/q/core/test","fileName":"cron.quke","feature":"","block":"Should","description":"","expectations":"may have a description","line":5,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-10T23:44:02.876248000","time":"0D00:00:00.000000000"},{"namespace":"src/q/core/test","fileName":"log.quke","feature":"","block":"Should","description":"","expectations":"","line":6,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-10T23:44:02.876965000","time":"0D00:00:00.000000000"},{"namespace":"src/q/core/test","fileName":"log.quke","feature":"","block":"Should","description":"","expectations":"","line":8,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-10T23:44:02.877002000","time":"0D00:00:00.000000000"},{"namespace":"src/q/core/test","fileName":"log.quke","feature":"","block":"Should","description":"","expectations":"","line":12,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-10T23:44:02.877075000","time":"0D00:00:00.000000000"},{"namespace":"src/q/reporting/test","fileName":"cube_function.quke","feature":"Count","block":"Should","description":"return the count of its input","expectations":"count on an atom to return 1","line":5,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-10T23:44:02.877683000","time":"0D00:00:00.000000000"},{"namespace":"src/q/reporting/test","fileName":"cube_function.quke","feature":"Count","block":"Should","description":"return the count of its input","expectations":"count of 1 drop list to return n - 1","line":8,"success":true,"result":{"expect":null,"toMatch":null,"expectError":"","toMatchError":""},"error":"","aborted":false,"skipped":true,"parseError":false,"start":"2020-11-10T23:44:02.877720000","time":"0D00:00:00.000000000"}]';
	//let dir = getTestDirectory();
	//console.log((vscode.workspace.getConfiguration('qcumberExplorer', null).get('directory'));
	let rawTests = JSON.parse(output);
	console.log(rawTests);
	//lets give each test an id, a TestSuite type and a label which is just Test 0 1 2 3...
	rawTests.forEach((rawTest: { id: string; type: string; file: string; namespace: string; fileName: string; label: string; }, index: number) => {
			rawTest.id = "test" + (index + 1);
			rawTest.type = "test";
			rawTest.file = rawTest.namespace + "/" + rawTest.fileName;
			// I know explicitly adding spaces isn't good style
			rawTest.label = "Test " + (index + 1);
		});

	//why isn't this a stock function
	var groupBy = function(array: any[], key: string) {
		return array.reduce(function(r: { [x: string]: any[]; }, x: { [x: string]: string | number; }) {
			r[x[key]] = r[x[key]] || []; //don't understand this
			r[x[key]].push(x);
			return r
		}, {});
	};

	//group by module, then group each subset by filename, then select type/id/label for each test
	//if we end up testing explicitly by service then the outer layer of 'module grouping' logic will be removed
	var moduleGroup = groupBy(rawTests, 'namespace');
	let moduleSuite: Array<TestSuiteInfo> = [];
	Object.keys(moduleGroup).forEach(key => {
		let rawTests = moduleGroup[key];
		var fileGroup = groupBy(rawTests, 'file');
		//var fileGroupNames = Object.keys(fileGroup);
		let fileSuite: Array<TestSuiteInfo> = [];
		Object.keys(fileGroup).forEach(key => {
			let tests = fileGroup[key];
			console.log(key);
			console.log(tests);
			let testsForFile: Array<TestInfo> = [];
			tests.forEach((test: any) => {
				const singleTest = (({ type, id, label, line, file }) => ({ type, id, label, line, file }))(test);
				testsForFile.push(singleTest);
			});
			var s = { type : 'suite', id : 'nested', label : tests[0].fileName, file : key, children : testsForFile };
			fileSuite.push(s);
		});
		var s = { type : 'suite', id : 'nested', label : key, children : fileSuite };
		moduleSuite.push(s);
	});

	//defines atart of our test suite
	let testSuite: TestSuiteInfo = {
		type: 'suite',
		id: 'root',
		label: 'QCumber',
		children: []
	  };
	testSuite.children = moduleSuite;
	console.log(testSuite);
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
