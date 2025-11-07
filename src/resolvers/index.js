import Resolver from '@forge/resolver';
import { storage, requestJira } from '@forge/api';

const resolver = new Resolver();

// Log utility function
const log = (message, data) => {
  console.log(`[${new Date().toISOString()}] ${message}:`, JSON.stringify(data, null, 2));
};

resolver.define('saveUserSettings', async ({ payload }) => {
  const { settings } = payload;
  const existingSettings = await storage.query().getMany();
  for (const setting of existingSettings.results) {
    await storage.delete(setting.key);
  }

  for (const setting of settings) {
    await storage.set(`setting_${setting.field}`, setting);
  }

  log('Saved user settings', settings);
  return { success: true };
});

// Get all settings
resolver.define('getSettings', async () => {
  const settingsResult = await storage.query().getMany();
  console.log('settingsResult:', typeof settingsResult, settingsResult);
  const settings = settingsResult.results.map(result => result.value);

  log('Fetched settings', settings);
  return { settings };
});


// Get stored Jira due dates
resolver.define('getJiraDueDates', async () => {
  const keysResult = await storage.query().getMany();
  log('Fetched keys from storage', keysResult);
  const keys = Array.isArray(keysResult) ? keysResult : [];
  const dueDates = [];
  
  for (const key of keys) {
    const data = await storage.get(key);
    log('Fetched data from storage for key', { key, data });
    if (data && data.dueDate) {
      dueDates.push({
        key,
        dueDate: data.dueDate,
      });
    }
  }
  
  return dueDates;
});

// Monitor Jira due date
resolver.define('monitorDueDate', async (req) => {
  const { issueKey } = req.payload;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1); // Mock data

  await storage.set(issueKey, { dueDate });

  return { success: true, dueDate };
});

// Check and trigger alerts
resolver.define('checkDueDateAlert', async (req) => {
  const jiraApiUrl = 'https://your-jira-instance.atlassian.net/rest/api/2/search';
  const jql = 'project=YOUR_PROJECT_KEY AND due <= now()+1d';
  
  try {
    const response = await requestJira(jiraApiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      query: {
        jql,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Jira API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    const issues = data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      dueDate: issue.fields.duedate,
    }));
    
    if (issues.length > 0) {
      // Send Teams alert
      const teamsWebhookUrl = 'YOUR_TEAMS_WEBHOOK_URL';
      const alertMessage = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0076D7",
        "summary": "Jira Due Date Alert",
        "sections": [{
          "activityTitle": "Upcoming Jira Due Dates",
          "facts": issues.map(issue => ({
            "name": `${issue.key}: ${issue.summary}`,
            "value": `Due: ${issue.dueDate}`
          })),
          "markdown": true
        }]
      };
      
      await api.fetch(teamsWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertMessage),
      });
    }
    
    return { success: true, issues };
  } catch (error) {
    console.error('Error checking due date alerts:', error);
    throw error;
  }
});

export const handler = resolver.getDefinitions();