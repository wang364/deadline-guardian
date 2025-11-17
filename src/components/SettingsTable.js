import React, { useState } from 'react';
import { Box, Button, Textfield, DynamicTable } from '@forge/react';
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
            issues: result.data.issues.length
          }
        }));
        
        // Show success notification
        alert(`JQL test successful! Found ${result.data.issues.length} issues.`);
      } else {
        setTestResults(prev => ({
          ...prev,
          [index]: {
            success: false,
            message: `Error: ${result.error}`,
            error: result.error
          }
        }));
        
        alert(`JQL test failed: ${result.error}`);
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
      
      alert(`Error testing JQL: ${error.message}`);
    } finally {
      setLoadingTests(prev => ({ ...prev, [index]: false }));
    }
  };

  // Prepare table header
  const head = {
    cells: [
      {
        key: "jql",
        content: "JQL Query",
        shouldTruncate: true,
        isSortable: false,
        width: "70%", // Allocate 70% width to JQL Query column
      },
      {
        key: "test",
        content: "Test",
        shouldTruncate: true,
        isSortable: false,
        width: "15%", // 15% for Test button column
      },
      {
        key: "actions",
        content: "Actions",
        shouldTruncate: true,
        isSortable: false,
        width: "15%", // 15% for Actions button column
      },
    ],
  };

  // Prepare row data
  const rows = settings.map((setting, index) => ({
    key: `row-${index}`,
    cells: [
      {
        key: `jql-${index}`,
        content: (
          <Textfield
            value={setting.jql || ''}
            onChange={(value) => handleChange(index, 'jql', value)}
            placeholder="Enter JQL query... (e.g., assignee = currentUser() AND resolution = Unresolved)"
            style={{ width: '100%' }}
          />
        ),
      },
      {
        key: `test-${index}`,
        content: (
          <Button 
            appearance="primary" 
            onClick={() => testJqlSearch(index, setting.jql)}
            isDisabled={loadingTests[index] || !setting.jql || !setting.jql.trim()}
          >
            {loadingTests[index] ? 'Testing...' : 'Test JQL Search'}
          </Button>
        ),
      },
      {
        key: `actions-${index}`,
        content: (
          <Button appearance="danger" onClick={() => deleteRow(index)}>Delete</Button>
        ),
      },
    ],
  }));

  return (
    <Box padding="space.200">
      <DynamicTable
        caption='JQL Query Settings'
        head={head}
        rows={rows}
        isFixedSize
      />
      <Box padding="medium" paddingTop="none">
        <Button appearance="primary" onClick={addRow}>Add New JQL Query</Button>
      </Box>
    </Box>
  );
};

export default SettingsTable;