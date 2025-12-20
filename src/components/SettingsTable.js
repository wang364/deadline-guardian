import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Textfield, DynamicTable, Text, Inline, Lozenge, Spinner, SectionMessage } from '@forge/react';
import { invoke } from '@forge/bridge';

// 多语言配置
const translations = {
  en: {
    jqlSettings: "JQL Query Settings",
    enterJqlQuery: "Enter JQL query... (e.g., assignee = currentUser() AND resolution = Unresolved)",
    enterJqlFirst: "Please enter a JQL query first",
    testJqlSearch: "Test JQL Search",
    testing: "Testing...",
    testSuccessful: "Test Successful",
    testFailed: "Test Failed",
    clearResult: "Clear Result",
    foundIssues: "Found {count} issues",
    error: "Error: {error}",
    exception: "Exception: {error}"
  },
  
  zh: {
    jqlSettings: "JQL 查询设置",
    enterJqlQuery: "输入 JQL 查询... (例如：assignee = currentUser() AND resolution = Unresolved)",
    enterJqlFirst: "请先输入 JQL 查询",
    testJqlSearch: "测试 JQL 查询",
    testing: "测试中...",
    testSuccessful: "测试成功",
    testFailed: "测试失败",
    clearResult: "清除结果",
    foundIssues: "找到 {count} 个问题",
    error: "错误: {error}",
    exception: "异常: {error}"
  }
};

// 翻译函数
const t = (key, params = {}, lang = 'en') => {
  let translation = translations[lang]?.[key] || translations['en'][key] || key;
  
  // 替换参数
  if (params && Object.keys(params).length > 0) {
    Object.keys(params).forEach(param => {
      translation = translation.replace(`{${param}}`, params[param]);
    });
  }
  
  return translation;
};

const SettingsTable = ({ settings, setSettings, language = 'en' }) => {
  const [testResults, setTestResults] = useState({});
  const [loadingTests, setLoadingTests] = useState({});

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
      alert(t('enterJqlFirst', {}, language));
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
            message: t('foundIssues', {count: result.issues.length}, language),
            issues: result.issues.length,
            sampleIssues: result.issues.slice(0, 3) // Show first 3 issues as sample
          }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          [index]: {
            success: false,
            message: t('error', {error: result.error}, language),
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
          message: t('exception', {error: error.message}, language),
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
              placeholder={t('enterJqlQuery', {}, language)}
              style={{ width: '100%' }}
            />
            {testResults[index] && (
              <Box paddingTop="space.100">
                <SectionMessage
                  appearance={testResults[index].success ? "success" : "error"}
                  title={testResults[index].success ? t('testSuccessful', {}, language) : t('testFailed', {}, language)}
                >
                  <Box>
                    <Text>{testResults[index].message}</Text>
                    {testResults[index].success && testResults[index].sampleIssues && (
                      <Box paddingTop="space.100">
                        {testResults[index].sampleIssues.map((issue) => (
                          <Box
                            key={issue.id || issue.key}
                            paddingTop="space.050"
                          >
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
                  <Text>{t('testing', {}, language)}</Text>
                </Inline>
              ) : t('testJqlSearch', {}, language)}
            </Button>
            {testResults[index] && (
              <Box paddingTop="space.050">
                <Button 
                  appearance="subtle" 
                  onClick={() => clearTestResult(index)}
                >
                  {t('clearResult', {}, language)}
                </Button>
              </Box>
            )}
          </Box>
        ),
      },
    ],
  }));

  return (
    <Box paddingInline="space.200">
      <Text size="large" weight="bold">{t('jqlSettings', {}, language)}</Text>
      <Box paddingTop="space.100">
        <DynamicTable
          rows={rows}
          isFixedSize
          // No emptyView needed as we always have at least one row
        />
      </Box>
    </Box>
  );
};

SettingsTable.propTypes = {
  /** Array of JQL query settings */
  settings: PropTypes.arrayOf(
    PropTypes.shape({
      /** JQL query string */
      jql: PropTypes.string
    })
  ).isRequired,
  /** Function to update settings */
  setSettings: PropTypes.func.isRequired,
  /** Language setting */
  language: PropTypes.string
};

export default SettingsTable;