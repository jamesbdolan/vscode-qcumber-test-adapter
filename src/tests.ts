import * as vscode from 'vscode';
import { TestSuiteInfo, TestInfo, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent } from 'vscode-test-adapter-api';
import * as childProcess from 'child_process';
import * as split2 from 'split2';
import { Log } from 'vscode-test-adapter-util';

export abstract class Tests {
  protected context: vscode.ExtensionContext;
  protected testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>;
  protected currentChildProcess: childProcess.ChildProcess | undefined;
  protected log: Log;
  protected testSuite: TestSuiteInfo | undefined;
  protected workspace: vscode.WorkspaceFolder;
  abstract testFrameworkName: string;
  protected debugCommandStartedResolver: Function | undefined;

  /**
   * @param context Extension context provided by vscode.
   * @param testStatesEmitter An emitter for the test suite's state.
   * @param log The Test Adapter logger, for logging.`
   */
  constructor(
    context: vscode.ExtensionContext,
    testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>,
    log: Log,
    workspace: vscode.WorkspaceFolder
  ) {
    this.context = context;
    this.testStatesEmitter = testStatesEmitter;
    this.log = log;
    this.workspace = workspace;
  }

  /**
   * Get the user-configured QCumber command and add file pattern detection.
   *
   * @return The QCumber command
   */
  protected getTestCommandWithFilePattern(): string {
    let command: string = (vscode.workspace.getConfiguration('qcumberExplorer', null).get('command') as string);
    const dir = this.getTestDirectory();
    let pattern = this.getFilePattern().map(p => `${dir}/**/${p}`).join(',')
    command = command || `docker exec -t q-views qcumber.sh`
    return `${command} --pattern '${pattern}'`;
  }
    /**
   * Perform a dry-run of the test suite to get information about every test.
   *
   * @return The raw output from the QCumber JSON formatter.
   */
  initTests = async () => new Promise<string>((resolve, reject) => {
    let cmd = `${this.getTestCommandWithFilePattern()} --require ${this.context.asAbsolutePath('./custom_formatter.rb')}`
              + ` --format CustomFormatter --order defined --dry-run`;

    this.log.info(`Running dry-run of QCumber test suite with the following command: ${cmd}`);

    // Allow a buffer of 64MB.
    const execArgs: childProcess.ExecOptions = {
      cwd: this.workspace.uri.fsPath,
      maxBuffer: 8192 * 8192
    };

    childProcess.exec(cmd, execArgs, (err, stdout) => {
      if (err) {
        this.log.error(`Error while finding QCumber test suite: ${err.message}`);
        // Show an error message.
        vscode.window.showWarningMessage(
          "QCumber Test Explorer failed to find a .quke test suite. Make sure QCumber is installed and your configured QCumber command is correct.",
          "View error message"
        ).then(selection => {
          if (selection === "View error message") {
            let outputJson = JSON.parse(Tests.getJsonFromOutput(stdout));
            let outputChannel = vscode.window.createOutputChannel('QCumber Test Explorer Error Message');

            if (outputJson.messages.length > 0) {
              let outputJsonString = outputJson.messages.join("\n\n");
              let outputJsonArray = outputJsonString.split("\n");
              outputJsonArray.forEach((line: string) => {
                outputChannel.appendLine(line);
              })
            } else {
              outputChannel.append(err.message);
            }
            outputChannel.show(false);
          }
        });

        throw err;
      }
      resolve(stdout);
    });
  });

  /**
   * Takes the output from initTests() and parses the resulting
   * JSON into a TestSuiteInfo object.
   *
   * @return The full test suite.
   */
  public async loadTests(): Promise<TestSuiteInfo> {
    let output = await this.initTests();
    this.log.debug('Passing raw output from dry-run into getJsonFromOutput.');
    this.log.debug(`${output}`);
    output = Tests.getJsonFromOutput(output);
    this.log.debug('Parsing the below JSON:');
    this.log.debug(`${output}`);
    let testMetadata;
    try {
      testMetadata = JSON.parse(output);
    } catch (error) {
      this.log.error(`JSON parsing failed: ${error}`);
    }

    let tests: Array<{ id: string; full_description: string; description: string; file_path: string; line_number: number; location: number; }> = [];

    testMetadata.examples.forEach((test: { id: string; full_description: string; description: string; file_path: string; line_number: number; location: number; }) => {
      let test_location_array: Array<string> = test.id.substring(test.id.indexOf("[") + 1, test.id.lastIndexOf("]")).split(':');
      let test_location_string: string = test_location_array.join('');
      test.location = parseInt(test_location_string);
      tests.push(test);
    });

    let testSuite: TestSuiteInfo = await this.getBaseTestSuite(tests);

    // Sort the children of each test suite based on their location in the test tree.
    (testSuite.children as Array<TestSuiteInfo>).forEach((suite: TestSuiteInfo) => {
      // NOTE: This will only sort correctly if everything is nested at the same
      // level, e.g. 111, 112, 121, etc. Once a fourth level of indentation is
      // introduced, the location is generated as e.g. 1231, which won't
      // sort properly relative to everything else.
      (suite.children as Array<TestInfo>).sort((a: TestInfo, b: TestInfo) => {
        if ((a as TestInfo).type === "test" && (b as TestInfo).type === "test") {
          let aLocation: number = this.getTestLocation(a as TestInfo);
          let bLocation: number = this.getTestLocation(b as TestInfo);
          return aLocation - bLocation;
        } else {
          return 0;
        }
      })
    });

    this.testSuite = testSuite;

    return Promise.resolve<TestSuiteInfo>(testSuite);
  }
    
  /**
   * Representation of the QCumber test suite as a TestSuiteInfo object.
   *
   * @return The QCumber test suite as a TestSuiteInfo object.
   */
  tests = async () => new Promise<TestSuiteInfo>((resolve, reject) => {
    try {
      // If test suite already exists, use testSuite. Otherwise, load them.
      let qcumberTests = this.testSuite ? this.testSuite : this.loadTests();
      return resolve(qcumberTests);
    } catch (err) {
      this.log.error(`Error while attempting to load QCumber tests: ${err.message}`);
      return reject(err);
    }
  });

  /**
   * Kills the current child process if one exists.
   */
  public killChild(): void {
    if (this.currentChildProcess) {
      this.currentChildProcess.kill();
    }
  }

  /**
  * Get the user-configured test file pattern.
  *
  * @return The file pattern
  */
  getFilePattern(): Array<string> {
    let pattern: Array<string> = (vscode.workspace.getConfiguration('qcumberExplorer', null).get('filePattern') as Array<string>);
    return pattern || ['*_test.rb', 'test_*.rb'];
  }


  /**
   * Pull JSON out of the test framework output.
   *
   * QCumber and Minitest frequently return bad data even when they're told to
   * format the output as JSON, e.g. due to code coverage messages and other
   * injections from gems. This gets the JSON by searching for
   * `START_OF_TEST_JSON` and an opening curly brace, as well as a closing
   * curly brace and `END_OF_TEST_JSON`. These are output by the custom
   * QCumber formatter or Minitest Rake task as part of the final JSON output.
   *
   * @param output The output returned by running a command.
   * @return A string representation of the JSON found in the output.
   */
  static getJsonFromOutput(output: string): string {
    output = output.substring(output.indexOf('START_OF_TEST_JSON{'), output.lastIndexOf('}END_OF_TEST_JSON') + 1);
    // Get rid of the `START_OF_TEST_JSON` and `END_OF_TEST_JSON` to verify that the JSON is valid.
    return output.substring(output.indexOf("{"), output.lastIndexOf("}") + 1);
  }

  /**
   * Get the location of the test in the testing tree.
   *
   * Test ids are in the form of `/spec/model/game_spec.rb[1:1:1]`, and this
   * function turns that into `111`. The number is used to order the tests
   * in the explorer.
   *
   * @param test The test we want to get the location of.
   * @return A number representing the location of the test in the test tree.
   */
  protected getTestLocation(test: TestInfo): number {
    return parseInt(test.id.substring(test.id.indexOf("[") + 1, test.id.lastIndexOf("]")).split(':').join(''));
  }

  /**
   * Convert a string from snake_case to PascalCase.
   * Note that the function will return the input string unchanged if it
   * includes a '/'.
   *
   * @param string The string to convert to PascalCase.
   * @return The converted string.
   */
  protected snakeToPascalCase(string: string): string {
    if (string.includes('/')) { return string }
    return string.split("_").map(substr => substr.charAt(0).toUpperCase() + substr.slice(1)).join("");
  }

  /**
   * Sorts an array of TestSuiteInfo objects by label.
   *
   * @param testSuiteChildren An array of TestSuiteInfo objects, generally the children of another TestSuiteInfo object.
   * @return The input array, sorted by label.
   */
  protected sortTestSuiteChildren(testSuiteChildren: Array<TestSuiteInfo>): Array<TestSuiteInfo> {
    testSuiteChildren = testSuiteChildren.sort((a: TestSuiteInfo, b: TestSuiteInfo) => {
      let comparison = 0;
      if (a.label > b.label) {
        comparison = 1;
      } else if (a.label < b.label) {
        comparison = -1;
      }
      return comparison;
    });

    return testSuiteChildren;
  }

    
  /**
   * Get the user-configured test directory, if there is one.
   *
   * @return The spec directory
   */
  getTestDirectory(): string {
    let directory: string = (vscode.workspace.getConfiguration('qcumberExplorer', null).get('directory') as string);
    return directory || './spec/';
  }
  /**
   * Get the tests in a given file.
   */
  public getTestSuiteForFile(
    { tests, currentFile, directory }: {
      tests: Array<{
        id: string;
        full_description: string;
        description: string;
        file_path: string;
        line_number: number;
        location: number;
      }>; currentFile: string; directory?: string;
    }): TestSuiteInfo {
    let currentFileTests = tests.filter(test => {
      return test.file_path === currentFile
    });

    let currentFileTestsInfo = currentFileTests as unknown as Array<TestInfo>;
    currentFileTestsInfo.forEach((test: TestInfo) => {
      test.type = 'test';
      test.label = '';
    });

    let currentFileLabel = '';

    if (directory) {
      currentFileLabel = currentFile.replace(`${this.getTestDirectory()}${directory}/`, '');
    } else {
      currentFileLabel = currentFile.replace(`${this.getTestDirectory()}`, '');
    }

    let pascalCurrentFileLabel = this.snakeToPascalCase(currentFileLabel.replace('_spec.rb', ''));

    let currentFileTestInfoArray: Array<TestInfo> = currentFileTests.map((test) => {
      // Concatenation of "/Users/username/whatever/project_dir" and "./spec/path/here.rb",
      // but with the latter's first character stripped.
      let filePath: string = `${this.workspace.uri.fsPath}${test.file_path.substr(1)}`;

      // QCumber provides test ids like "file_name.rb[1:2:3]".
      // This uses the digits at the end of the id to create
      // an array of numbers representing the location of the
      // test in the file.
      let testLocationArray: Array<number> = test.id.substring(test.id.indexOf("[") + 1, test.id.lastIndexOf("]")).split(':').map((x) => {
        return parseInt(x);
      });

      // Get the last element in the location array.
      let testNumber: number = testLocationArray[testLocationArray.length - 1];
      // If the test doesn't have a name (because it uses the 'it do' syntax), "test #n"
      // is appended to the test description to distinguish between separate tests.
      let description: string = test.description.startsWith('example at ') ? `${test.full_description}test #${testNumber}` : test.full_description;

      // If the current file label doesn't have a slash in it and it starts with the PascalCase'd
      // file name, remove the from the start of the description. This turns, e.g.
      // `ExternalAccount Validations blah blah blah' into 'Validations blah blah blah'.
      if (!pascalCurrentFileLabel.includes('/') && description.startsWith(pascalCurrentFileLabel)) {
        // Optional check for a space following the PascalCase file name. In some
        // cases, e.g. 'FileName#method_name` there's no space after the file name.
        let regexString = `${pascalCurrentFileLabel}[ ]?`;
        let regex = new RegExp(regexString, "g");
        description = description.replace(regex, '');
      }

      let testInfo: TestInfo = {
        type: 'test',
        id: test.id,
        label: description,
        file: filePath,
        // Line numbers are 0-indexed
        line: test.line_number - 1
      }

      return testInfo;
    });

    let currentFileAsAbsolutePath = `${this.workspace.uri.fsPath}${currentFile.substr(1)}`;

    let currentFileTestSuite: TestSuiteInfo = {
      type: 'suite',
      id: currentFile,
      label: currentFileLabel,
      file: currentFileAsAbsolutePath,
      children: currentFileTestInfoArray
    }

    return currentFileTestSuite;
  }

  /**
   * Create the base test suite with a root node and one layer of child nodes
   * representing the subdirectories of spec/, and then any files under the
   * given subdirectory.
   *
   * @param tests Test objects returned by our custom QCumber formatter or Minitest Rake task.
   * @return The test suite root with its children.
   */
  public async getBaseTestSuite(
    tests: any[]
  ): Promise<TestSuiteInfo> {
    let rootTestSuite: TestSuiteInfo = {
      type: 'suite',
      id: 'root',
      label: `${this.workspace.name} ${this.testFrameworkName}`,
      children: []
    };

    // Create an array of all test files and then abuse Sets to make it unique.
    let uniqueFiles = [...new Set(tests.map((test: { file_path: string; }) => test.file_path))];

    let splitFilesArray: Array<string[]> = [];

    // Remove the spec/ directory from all the file path.
    uniqueFiles.forEach((file) => {
      splitFilesArray.push(file.replace(`${this.getTestDirectory()}`, "").split('/'));
    });

    // This gets the main types of tests, e.g. features, helpers, models, requests, etc.
    let subdirectories: Array<string> = [];
    splitFilesArray.forEach((splitFile) => {
      if (splitFile.length > 1) {
        subdirectories.push(splitFile[0]);
      }
    });
    subdirectories = [...new Set(subdirectories)];

    // A nested loop to iterate through the direct subdirectories of spec/ and then
    // organize the files under those subdirectories.
    subdirectories.forEach((directory) => {
      let filesInDirectory: Array<TestSuiteInfo> = [];

      let uniqueFilesInDirectory: Array<string> = uniqueFiles.filter((file) => {
        return file.startsWith(`${this.getTestDirectory()}${directory}/`);
      });

      // Get the sets of tests for each file in the current directory.
      uniqueFilesInDirectory.forEach((currentFile: string) => {
        let currentFileTestSuite = this.getTestSuiteForFile({ tests, currentFile, directory });
        filesInDirectory.push(currentFileTestSuite);
      });

      let directoryTestSuite: TestSuiteInfo = {
        type: 'suite',
        id: directory,
        label: directory,
        children: filesInDirectory
      };

      rootTestSuite.children.push(directoryTestSuite);
    });

    // Sort test suite types alphabetically.
    rootTestSuite.children = this.sortTestSuiteChildren(rootTestSuite.children as Array<TestSuiteInfo>);

    // Get files that are direct descendants of the spec/ directory.
    let topDirectoryFiles = uniqueFiles.filter((filePath) => {
      return filePath.replace(`${this.getTestDirectory()}`, "").split('/').length === 1;
    });

    topDirectoryFiles.forEach((currentFile) => {
      let currentFileTestSuite = this.getTestSuiteForFile({ tests, currentFile });
      rootTestSuite.children.push(currentFileTestSuite);
    });

    return rootTestSuite;
  }

  /**
   * Runs the test suite by iterating through each test and running it.
   *
   * @param tests
   * @param debuggerConfig A VS Code debugger configuration.
   */
  runTests = async (tests: string[], debuggerConfig?: vscode.DebugConfiguration): Promise<void> => {
    let testSuite: TestSuiteInfo = await this.tests();

    for (const suiteOrTestId of tests) {
      const node = this.findNode(testSuite, suiteOrTestId);
      if (node) {
        await this.runNode(node, debuggerConfig);
      }
    }
  }

  /**
   * Recursively search for a node in the test suite list.
   *
   * @param searchNode The test or test suite to search in.
   * @param id The id of the test or test suite.
   */
  protected findNode(searchNode: TestSuiteInfo | TestInfo, id: string): TestSuiteInfo | TestInfo | undefined {
    if (searchNode.id === id) {
      return searchNode;
    } else if (searchNode.type === 'suite') {
      for (const child of searchNode.children) {
        const found = this.findNode(child, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * Recursively run a node or its children.
   *
   * @param node A test or test suite.
   * @param debuggerConfig A VS Code debugger configuration.
   */
  protected async runNode(node: TestSuiteInfo | TestInfo, debuggerConfig?: vscode.DebugConfiguration): Promise<void> {
    // Special case handling for the root suite, since it can be run
    // with runFullTestSuite()
    if (node.type === 'suite' && node.id === 'root') {
      this.testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.id, state: 'running' });

      let testOutput = await this.runFullTestSuite(debuggerConfig);
      testOutput = Tests.getJsonFromOutput(testOutput);
      this.log.debug('Parsing the below JSON:');
      this.log.debug(`${testOutput}`);
      let testMetadata = JSON.parse(testOutput);
      let tests: Array<any> = testMetadata.examples;

      if (tests && tests.length > 0) {
        tests.forEach((test: { id: string | TestInfo; }) => {
          this.handleStatus(test);
        });
      }

      this.testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'completed' });
      // If the suite is a file, run the tests as a file rather than as separate tests.
    } else if (node.type === 'suite' && node.label.endsWith('.rb')) {
      this.testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'running' });

      let testOutput = await this.runTestFile(`${node.file}`, debuggerConfig);

      testOutput = Tests.getJsonFromOutput(testOutput);
      this.log.debug('Parsing the below JSON:');
      this.log.debug(`${testOutput}`);
      let testMetadata = JSON.parse(testOutput);
      let tests: Array<any> = testMetadata.examples;

      if (tests && tests.length > 0) {
        tests.forEach((test: { id: string | TestInfo; }) => {
          this.handleStatus(test);
        });
      }

      this.testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'completed' });

    } else if (node.type === 'suite') {

      this.testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'running' });

      for (const child of node.children) {
        await this.runNode(child, debuggerConfig);
      }

      this.testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'completed' });

    } else if (node.type === 'test') {
      if (node.file !== undefined && node.line !== undefined) {
        this.testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.id, state: 'running' });

        // Run the test at the given line, add one since the line is 0-indexed in
        // VS Code and 1-indexed for QCumber/Minitest.
        let testOutput = await this.runSingleTest(`${node.file}:${node.line + 1}`, debuggerConfig);

        testOutput = Tests.getJsonFromOutput(testOutput);
        this.log.debug('Parsing the below JSON:');
        this.log.debug(`${testOutput}`);
        let testMetadata = JSON.parse(testOutput);
        let currentTest = testMetadata.examples[0];

        this.handleStatus(currentTest);
      }
    }
  }

  public async debugCommandStarted(): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      this.debugCommandStartedResolver = resolve;
      setTimeout(() => { reject("debugCommandStarted timed out") }, 10000)
    })
  }


  /**
   * Handles test state based on the output returned by the test command.
   *
   * @param test The test that we want to handle.
   */
  handleStatus(test: any): void {
    this.log.debug(`Handling status of test: ${JSON.stringify(test)}`);
    if (test.status === "passed") {
      this.testStatesEmitter.fire(<TestEvent>{ type: 'test', test: test.id, state: 'passed' });
    } else if (test.status === "failed" && test.pending_message === null) {
      // Remove linebreaks from error message.
      let errorMessageNoLinebreaks = test.exception.message.replace(/(\r\n|\n|\r)/, ' ');
      // Prepend the class name to the error message string.
      let errorMessage: string = `${test.exception.class}:\n${errorMessageNoLinebreaks}`;

      let fileBacktraceLineNumber: number | undefined;

      let filePath = test.file_path.replace('./', '');

      // Add backtrace to errorMessage if it exists.
      if (test.exception.backtrace) {
        errorMessage += `\n\nBacktrace:\n`;
        test.exception.backtrace.forEach((line: string) => {
          errorMessage += `${line}\n`;
          // If the backtrace line includes the current file path, try to get the line number from it.
          if (line.includes(filePath)) {
            let filePathArray = filePath.split('/');
            let fileName = filePathArray[filePathArray.length - 1];
            // Input: spec/models/game_spec.rb:75:in `block (3 levels) in <top (required)>
            // Output: 75
            let regex = new RegExp(`${fileName}\:(\\d+)`);
            let match = line.match(regex);
            if (match && match[1]) {
              fileBacktraceLineNumber = parseInt(match[1]);
            }
          }
        });
      }

      this.testStatesEmitter.fire(<TestEvent>{
        type: 'test',
        test: test.id,
        state: 'failed',
        message: errorMessage,
        decorations: [{
          // Strip line breaks from the message.
          message: errorMessageNoLinebreaks,
          line: (fileBacktraceLineNumber ? fileBacktraceLineNumber : test.line_number) - 1
        }]
      });
    } else if (test.status === "failed" && test.pending_message !== null) {
      // Handle pending test cases.
      this.testStatesEmitter.fire(<TestEvent>{ type: 'test', test: test.id, state: 'skipped', message: test.pending_message });
    }
  };
  
  /**
   * Get the user-configured QCumber command, if there is one.
   *
   * @return The QCumber command
   */
  protected getTestCommand(): string {
    let command: string = (vscode.workspace.getConfiguration('qcumberExplorer', null).get('command') as string);
    return command || `docker exec -t q-views qcumber.sh`
  }

  /**
   * Get test command with formatter and debugger arguments
   *
   * @param debuggerConfig A VS Code debugger configuration.
   * @return The test command
   */
  protected testCommandWithFormatterAndDebugger(debuggerConfig?: vscode.DebugConfiguration): string {
    let args = `--require ${this.context.asAbsolutePath('./custom_formatter.rb')} --format CustomFormatter`
    let cmd = `${this.getTestCommand()} ${args}`
    if (debuggerConfig) {
      cmd = `rdebug-ide --host ${debuggerConfig.remoteHost} --port ${debuggerConfig.remotePort}`
            + ` -- ${(process.platform == 'win32') ? '%EXT_DIR%' : '$EXT_DIR'}/debug_rspec.rb ${args}`
    }
    return cmd
  }

  /**
   * Get the env vars to run the subprocess with.
   *
   * @return The env
   */
  protected getProcessEnv(): any {
    return Object.assign({}, process.env, {
      "EXT_DIR": this.context.asAbsolutePath('./ruby'),
    });
  }

   /**
   * Assigns the process to currentChildProcess and handles its output and what happens when it exits.
   *
   * @param process A process running the tests.
   * @return A promise that resolves when the test run completes.
   */
  handleChildProcess = async (process: childProcess.ChildProcess) => new Promise<string>((resolve, reject) => {
    this.currentChildProcess = process;

    this.currentChildProcess.on('exit', () => {
      this.log.info('Child process has exited. Sending test run finish event.');
      this.currentChildProcess = undefined;
      this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });
      resolve('{}');
    });

    this.currentChildProcess.stderr!.pipe(split2()).on('data', (data) => {
      data = data.toString();
      this.log.debug(`[CHILD PROCESS OUTPUT] ${data}`);
      if (data.startsWith('Fast Debugger') && this.debugCommandStartedResolver) {
        this.debugCommandStartedResolver()
      }
    });

    this.currentChildProcess.stdout!.pipe(split2()).on('data', (data) => {
      data = data.toString();
      this.log.debug(`[CHILD PROCESS OUTPUT] ${data}`);
      if (data.startsWith('PASSED:')) {
        data = data.replace('PASSED: ', '');
        this.testStatesEmitter.fire(<TestEvent>{ type: 'test', test: data, state: 'passed' });
      } else if (data.startsWith('FAILED:')) {
        data = data.replace('FAILED: ', '');
        this.testStatesEmitter.fire(<TestEvent>{ type: 'test', test: data, state: 'failed' });
      } else if (data.startsWith('RUNNING:')) {
        data = data.replace('RUNNING: ', '');
        this.testStatesEmitter.fire(<TestEvent>{ type: 'test', test: data, state: 'running' });
      } else if (data.startsWith('PENDING:')) {
        data = data.replace('PENDING: ', '');
        this.testStatesEmitter.fire(<TestEvent>{ type: 'test', test: data, state: 'skipped' });
      }
      if (data.includes('START_OF_TEST_JSON')) {
        resolve(data);
      }
    });
  });

  /**
   * Runs a single test.
   *
   * @param testLocation A file path with a line number, e.g. `/path/to/spec.rb:12`.
   * @param debuggerConfig A VS Code debugger configuration.
   * @return The raw output from running the test.
   */
  runSingleTest = async (testLocation: string, debuggerConfig?: vscode.DebugConfiguration) => new Promise<string>(async (resolve, reject) => {
    this.log.info(`Running single test: ${testLocation}`);
    const spawnArgs: childProcess.SpawnOptions = {
      cwd: this.workspace.uri.fsPath,
      shell: true,
      env: this.getProcessEnv()
    };

    let testCommand = `${this.testCommandWithFormatterAndDebugger(debuggerConfig)} '${testLocation}'`;
    this.log.info(`Running command: ${testCommand}`);

    let testProcess = childProcess.spawn(
      testCommand,
      spawnArgs
    );

    resolve(await this.handleChildProcess(testProcess));
  });

  /**
   * Runs tests in a given file.
   *
   * @param testFile The test file's file path, e.g. `/path/to/spec.rb`.
   * @param debuggerConfig A VS Code debugger configuration.
   * @return The raw output from running the tests.
   */
  runTestFile = async (testFile: string, debuggerConfig?: vscode.DebugConfiguration) => new Promise<string>(async (resolve, reject) => {
    this.log.info(`Running test file: ${testFile}`);
    const spawnArgs: childProcess.SpawnOptions = {
      cwd: this.workspace.uri.fsPath,
      shell: true
    };

    // Run tests for a given file at once with a single command.
    let testCommand = `${this.testCommandWithFormatterAndDebugger(debuggerConfig)} '${testFile}'`;
    this.log.info(`Running command: ${testCommand}`);

    let testProcess = childProcess.spawn(
      testCommand,
      spawnArgs
    );

    resolve(await this.handleChildProcess(testProcess));
  });

  /**
   * Runs the full test suite for the current workspace.
   *
   * @param debuggerConfig A VS Code debugger configuration.
   * @return The raw output from running the test suite.
   */
  runFullTestSuite = async (debuggerConfig?: vscode.DebugConfiguration) => new Promise<string>(async (resolve, reject) => {
    this.log.info(`Running full test suite.`);
    const spawnArgs: childProcess.SpawnOptions = {
      cwd: this.workspace.uri.fsPath,
      shell: true
    };

    let testCommand = this.testCommandWithFormatterAndDebugger(debuggerConfig);
    this.log.info(`Running command: ${testCommand}`);

    let testProcess = childProcess.spawn(
      testCommand,
      spawnArgs
    );

    resolve(await this.handleChildProcess(testProcess));
  });
}
