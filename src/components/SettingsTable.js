import { Box, Button, Textfield, DynamicTable, Text, Inline, Lozenge, Spinner, SectionMessage } from '@forge/react';
import { invoke } from '@forge/bridge';

const SettingsTable = ({ settings, setSettings }) => {
  const [testResults, setTestResults] = useState({});
  const [loadingTests, setLoadingTests] = useState({});

  // Use functional updates to avoid stale closures and race conditions
  const addRow = () => {
    setSettings(prev => [...prev, { jql: '' }]);
  };

  const deleteRow = (index) => {
    setSettings(prev => {
      const newSettings = [...prev];
      newSettings.splice(index, 1);
      // Ensure at least one empty row exists
      if (newSettings.length === 0) {
        newSettings.push({ jql: '' });
      }
      return newSettings;
    });
  };

  const handleChange = (index, field, value) => {
    console.log(value);
    value = value.target.value;
    console.log(`Updating setting at index ${index}: ${field} = ${value}`); 
    setSettings(prev => {
      const newSettings = prev.map((s, i) => (i === index ? { ...s, [field]: value } : s));
      return newSettings;
    });
    
    // Clear test result when JQL query changes
    setTestResults(prev => {
      const newResults = { ...prev };
      delete newResults[index];
      return newResults;
    });
  };

  const testJqlSearch = async (index, jql) => {
    if (!jql || !jql.trim()) {
      alert('Please enter a JQL query first');
      return;
    }

    setLoadingTests(prev => ({ ...prev, [index]: true }));
    
    try {
      console.log(`Testing JQL search for row ${index}:`, jql);
      
      const result = await invoke('searchIssuesWithJql', {
        jql: jql.trim(),
        maxResults: 5,
        fields: ['key', 'summary', 'status', 'priority', 'assignee', 'duedate', 'updated']
      });
      
      console.log(`JQL test result for row ${index}:`, result);
      
      if (result.success) {
        setTestResults(prev => ({
          ...prev,
          [index]: {
            success: true,
            message: `Found ${result.data.issues.length} issues`,
            issues: result.data.issues.length,
            sampleIssues: result.data.issues.slice(0, 3) // Show first 3 issues as sample
          }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          [index]: {
            success: false,
            message: `Error: ${result.error}`,
            error: result.error
          }
        }));
      }
    } catch (error) {
      console.error(`Error testing JQL for row ${index}:`, error);
      setTestResults(prev => ({
        ...prev,
        [index]: {
          success: false,
          message: `Exception: ${error.message}`,
          error: error.message
        }
      }));
    } finally {
      setLoadingTests(prev => ({ ...prev, [index]: false }));
    }
  };

  // Clear test result for a specific row
  const clearTestResult = (index) => {
    setTestResults(prev => {
      const newResults = { ...prev };
      delete newResults[index];
      return newResults;
    });
  };

  // Prepare table header
  const head = {
    cells: [
      {
        key: "jql",
        content: "JQL Query",
        shouldTruncate: false,
        isSortable: false,
      },
      {
        key: "test",
        content: "Test",
        shouldTruncate: true,
        isSortable: false,
      },
      {
        key: "actions",
        content: "Actions",
        shouldTruncate: true,
        isSortable: false,
      },
    ],
  };

  // Prepare row data - ensure at least one empty row exists when settings is empty
  const rows = settings.map((setting, index) => ({
    key: `row-${index}`,
    cells: [
      {
        key: `jql-${index}`,
        content: (
          <Box>
            <Textfield
              value={setting.jql || ''}
              onChange={(value) => handleChange(index, 'jql', value)}
              placeholder="Enter JQL query... (e.g., assignee = currentUser() AND resolution = Unresolved)"
              style={{ width: '100%' }}
            />
            {testResults[index] && (
              <Box paddingTop="space.100">
                <SectionMessage
                  appearance={testResults[index].success ? "success" : "error"}
                  title={testResults[index].success ? "Test Successful" : "Test Failed"}
                >
                  <Box>
                    <Text>{testResults[index].message}</Text>
                    {testResults[index].success && testResults[index].sampleIssues && (
                      <Box paddingTop="space.100">
                        {testResults[index].sampleIssues.map((issue, i) => (
                          <Box key={i} paddingTop="space.050">
                            <Inline>
                              <Lozenge appearance="inprogress">{issue.key}</Lozenge>
                              <Text size="small">{issue.fields.summary}</Text>
                            </Inline>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </SectionMessage>
              </Box>
            )}
          </Box>
        ),
        colSpan: 4,
      },
      {
        key: `test-${index}`,
        content: (
          <Box>
            <Button 
              appearance="primary" 
              onClick={() => testJqlSearch(index, setting.jql)}
              isDisabled={loadingTests[index] || !setting.jql || !setting.jql.trim()}
            >
              {loadingTests[index] ? (
                <Inline>
                  <Spinner size="small" />
                  <Text>Testing...</Text>
                </Inline>
              ) : 'Test JQL Search'}
            </Button>
            {testResults[index] && (
              <Box paddingTop="space.050">
                <Button 
                  appearance="subtle" 
                  onClick={() => clearTestResult(index)}
                >
                  Clear Result
                </Button>
              </Box>
            )}
          </Box>
        ),
      },
      /* {
        key: `actions-${index}`,
        content: (
          <Button appearance="danger" onClick={() => deleteRow(index)}>Delete</Button>
        ),
      }, */
    ],
  }));

  return (
    <Box paddingInline="space.200">
      <Text size="large" weight="bold">JQL Query Settings</Text>
      <Box paddingTop="space.100">
        <DynamicTable
          // head={head}
          rows={rows}
          isFixedSize
          // No emptyView needed as we always have at least one row
        />
      </Box>
      {/* <Box padding="medium" paddingTop="none">
        <Inline>
          <Button appearance="primary" onClick={addRow}>Add New JQL Query</Button>
        </Inline>
      </Box> */}
    </Box>
  );
};

export default SettingsTable;