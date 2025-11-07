import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Text, Textfield, Button, Select, Label, RequiredAsterisk, ErrorMessage } from '@forge/react';
import { invoke } from '@forge/bridge';
import SettingsTable from '../components/SettingsTable';

const App = () => {
  const [settings, setSettings] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(undefined);
  const [schedulePeriod, setSchedulePeriod] = useState('daily');
  const [scheduleTime, setScheduleTime] = useState('17:00');
  useEffect(() => {
    invoke('getSettings').then(({ settings }) => setSettings(settings || []));
  }, []);

  const handleSaveSettings = async () => {
    try {
      const response = await invoke('saveUserSettings', { settings });
      setMessage(response.success ? 'Settings saved successfully' : 'Failed to save settings');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <SettingsTable
        settings={settings}
        setSettings={setSettings}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Text>{message}</Text>

      <Box padding="medium" borderWidth="1px" borderStyle="solid" borderColor="gray">
        <Text size="large" weight="bold">Schedule Settings</Text>
        <Box padding="small">
          <Select
            label="Schedule Period"
            value={schedulePeriod}
            onChange={(e) => setSchedulePeriod(e.target.value)}
            options={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' }
            ]}
          />
        </Box>
        <Box padding="small">
          <Label labelFor="scheduleTime">
            Schedule Time (HH:MM)
            <RequiredAsterisk />
          </Label>
          <Textfield
            id="scheduleTime"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
          />
        </Box>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Box padding="small">
          <Button appearance="primary" onClick={handleSaveSettings}>Save Settings</Button>
        </Box>
      </Box>
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);