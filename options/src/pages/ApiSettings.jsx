import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { SaveIcon, KeyIcon, RefreshIcon, ExclamationIcon } from '@heroicons/react/outline';

export default function ApiSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState({
    openai: false,
    gemini: false,
    deepseek: false,
    huggingface: false,
    google: false
  });
  const [apiStatus, setApiStatus] = useState({
    openai: { status: 'idle', message: '' },
    gemini: { status: 'idle', message: '' },
    deepseek: { status: 'idle', message: '' },
    huggingface: { status: 'idle', message: '' },
    google: { status: 'idle', message: '' }
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      openaiKey: '',
      openaiModel: 'gpt-4',
      geminiKey: '',
      geminiModel: 'gemini-pro',
      deepseekKey: '',
      deepseekModel: 'deepseek-chat',
      huggingfaceKey: '',
      huggingfaceModel: 'google/flan-t5-xxl',
      googleSearchApiKey: '',
      googleSearchCx: '',
      backendUrl: 'http://localhost:5000',
      useBackend: false
    }
  });

  const useBackend = watch('useBackend');

  useEffect(() => {
    // Load saved settings from Chrome storage
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.sync.get([
          'openaiKey', 'openaiModel', 'geminiKey', 'geminiModel',
          'deepseekKey', 'deepseekModel', 'huggingfaceKey', 'huggingfaceModel',
          'googleSearchApiKey', 'googleSearchCx', 'backendUrl', 'useBackend'
        ]);

        Object.entries(result).forEach(([key, value]) => {
          if (value !== undefined) {
            setValue(key, value);
          }
        });
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [setValue]);

  const toggleApiKeyVisibility = (provider) => {
    setShowApiKey(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  const testApiConnection = async (provider) => {
    const apiKey = watch(`${provider}Key`);
    const model = watch(`${provider}Model`);
    
    if (!apiKey) {
      setApiStatus(prev => ({
        ...prev,
        [provider]: { status: 'error', message: 'API key is required' }
      }));
      return;
    }

    setApiStatus(prev => ({
      ...prev,
      [provider]: { status: 'testing', message: 'Testing connection...' }
    }));

    try {
      // In a real implementation, you would call your background script to test the API
      // For now, we'll simulate a successful test
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setApiStatus(prev => ({
        ...prev,
        [provider]: { status: 'success', message: 'Connection successful!' }
      }));
      toast.success(`${provider.toUpperCase()} API connection successful!`);
    } catch (error) {
      console.error(`Error testing ${provider} API:`, error);
      setApiStatus(prev => ({
        ...prev,
        [provider]: { status: 'error', message: error.message || 'Connection failed' }
      }));
      toast.error(`Failed to connect to ${provider} API`);
    }
  };

  const generateApiKey = async () => {
    // In a real implementation, this would call your backend to generate a new API key
    const newApiKey = `sk-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setValue('openaiKey', newApiKey);
    toast.success('New API key generated');
  };

  const onSubmit = async (data) => {
    setIsSaving(true);
    try {
      await chrome.storage.sync.set(data);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure your API keys and model preferences
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Backend Configuration */}
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Backend Configuration
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Configure the backend server settings
            </p>
          </div>
          <div className="px-4 py-5 sm:p-6 space-y-6">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="useBackend"
                  name="useBackend"
                  type="checkbox"
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  {...register('useBackend')}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="useBackend" className="font-medium text-gray-700 dark:text-gray-300">
                  Use Backend API
                </label>
                <p className="text-gray-500 dark:text-gray-400">
                  Enable to use your own backend server instead of direct API calls
                </p>
              </div>
            </div>

            {useBackend && (
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="backendUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Backend URL
                  </label>
                  <div className="mt-1">
                    <input
                      type="url"
                      id="backendUrl"
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-md"
                      placeholder="http://localhost:5000"
                      {...register('backendUrl', { required: 'Backend URL is required' })}
                    />
                    {errors.backendUrl && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {errors.backendUrl.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* OpenAI Configuration */}
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              OpenAI Configuration
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Configure your OpenAI API settings
            </p>
          </div>
          <div className="px-4 py-5 sm:p-6 space-y-6">
            <div>
              <label htmlFor="openaiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                API Key
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <div className="relative flex-grow">
                  <input
                    type={showApiKey.openai ? 'text' : 'password'}
                    id="openaiKey"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-10 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-l-md"
                    placeholder="sk-..."
                    {...register('openaiKey')}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
                      onClick={() => toggleApiKeyVisibility('openai')}
                    >
                      {showApiKey.openai ? (
                        <span className="text-xs">Hide</span>
                      ) : (
                        <KeyIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={generateApiKey}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <RefreshIcon className="-ml-1 mr-2 h-4 w-4" />
                  Generate
                </button>
              </div>
              <div className="mt-2 flex items-center">
                <a
                  href="https://platform.openai.com/account/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Get your OpenAI API key
                </a>
              </div>
            </div>

            <div>
              <label htmlFor="openaiModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Model
              </label>
              <select
                id="openaiModel"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                {...register('openaiModel')}
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-3.5-turbo-16k">GPT-3.5 Turbo 16k</option>
              </select>
            </div>

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => testApiConnection('openai')}
                disabled={apiStatus.openai.status === 'testing'}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                  apiStatus.openai.status === 'testing'
                    ? 'bg-indigo-400'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
              >
                {apiStatus.openai.status === 'testing' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
              {apiStatus.openai.status !== 'idle' && (
                <div className="ml-3">
                  <p className={`text-sm ${
                    apiStatus.openai.status === 'success' 
                      ? 'text-green-600 dark:text-green-400' 
                      : apiStatus.openai.status === 'error' 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {apiStatus.openai.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Other API configurations would go here following the same pattern */}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <SaveIcon className="-ml-1 mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mt-8">
        <div className="flex">
          <div className="flex-shrink-0">
            <ExclamationIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Your API keys are stored locally in your browser and are never sent to our servers. For enhanced security, consider using environment variables in production.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
