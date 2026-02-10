import axios from 'axios';
import {
  getCurrentWeather,
  getWeatherForecast,
  getWeatherByCoordinates,
  checkWeatherAlert,
  isWeatherConfigured
} from '../services/weatherService.js';
import Alert from '../models/Alert.js';
import InstructorNotification from '../models/InstructorNotification.js';
import Instructor from '../models/Instructor.js';
import { getSchedulerStatus, triggerWeatherCheck } from '../services/weatherScheduler.js';

export const getCurrent = async (req, res) => {
  try {
    const { city, countryCode } = req.query;
    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'City name is required. Use ?city=Manila&countryCode=PH'
      });
    }
    const result = await getCurrentWeather(city, countryCode || 'PH');
    const alertCheck = checkWeatherAlert(result.data);
    res.json({
      success: true,
      weather: result.data,
      alert: alertCheck,
      configured: isWeatherConfigured()
    });
  } catch (error) {
    console.error('Error fetching current weather:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch weather data',
      configured: isWeatherConfigured()
    });
  }
};

export const getForecast = async (req, res) => {
  try {
    const { city, countryCode } = req.query;
    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'City name is required. Use ?city=Manila&countryCode=PH'
      });
    }
    const result = await getWeatherForecast(city, countryCode || 'PH');
    res.json({
      success: true,
      forecast: result.data,
      configured: isWeatherConfigured()
    });
  } catch (error) {
    console.error('Error fetching weather forecast:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch weather forecast',
      configured: isWeatherConfigured()
    });
  }
};

export const getByCoordinates = async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required. Use ?lat=14.5995&lon=120.9842'
      });
    }
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude values'
      });
    }
    const result = await getWeatherByCoordinates(latitude, longitude);
    const alertCheck = checkWeatherAlert(result.data);
    res.json({
      success: true,
      weather: result.data,
      alert: alertCheck,
      configured: isWeatherConfigured()
    });
  } catch (error) {
    console.error('Error fetching weather by coordinates:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch weather data',
      configured: isWeatherConfigured()
    });
  }
};

export const checkAndAlert = async (req, res) => {
  try {
    const { city, countryCode = 'PH', autoCreateAlert = false } = req.body;
    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'City name is required'
      });
    }
    const result = await getCurrentWeather(city, countryCode);
    const alertCheck = checkWeatherAlert(result.data);

    if (alertCheck.hasAlert && autoCreateAlert && alertCheck.severity !== 'info') {
      const alertMessage = `⚠️ Weather Alert: ${alertCheck.message} | Current: ${result.data.description}, ${result.data.temperature}°C`;
      const alert = await Alert.create({
        type: 'weather-alert',
        message: alertMessage,
        meta: {
          severity: alertCheck.severity,
          weatherData: result.data,
          alerts: alertCheck.alerts,
          city
        }
      });

      const instructors = await Instructor.find({ status: 'active' });
      const notifications = instructors.map(instructor => ({
        instructorEmail: instructor.email,
        title: 'Weather Alert',
        message: alertMessage,
        read: false
      }));
      if (notifications.length > 0) {
        await InstructorNotification.insertMany(notifications);
      }

      if (req.io) {
        req.io.emit('weather-alert', {
          alert,
          weather: result.data,
          alertCheck
        });
      }

      return res.json({
        success: true,
        weather: result.data,
        alert: alertCheck,
        alertCreated: true,
        alertId: alert._id
      });
    }

    res.json({
      success: true,
      weather: result.data,
      alert: alertCheck,
      alertCreated: false,
      message: autoCreateAlert ? 'No severe weather conditions detected' : 'Set autoCreateAlert=true to create alerts automatically'
    });
  } catch (error) {
    console.error('Error checking weather and creating alert:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check weather',
      configured: isWeatherConfigured()
    });
  }
};

export const getSchedulerStatusHandler = (req, res) => {
  try {
    const status = getSchedulerStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const triggerScheduler = async (req, res) => {
  try {
    await triggerWeatherCheck();
    res.json({ success: true, message: 'Weather check triggered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStatus = async (req, res) => {
  const configured = isWeatherConfigured();
  let keyValid = false;
  let keyError = null;

  if (configured) {
    try {
      const testResponse = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: {
          q: 'London',
          appid: process.env.OPENWEATHER_API_KEY,
          units: 'metric'
        },
        timeout: 5000
      });
      keyValid = testResponse.status === 200;
    } catch (error) {
      if (error.response?.status === 401) {
        keyValid = false;
        keyError = 'Invalid API key. Please check your OPENWEATHER_API_KEY in .env file. Make sure there are no extra spaces or quotes.';
      } else if (error.response?.status === 403) {
        keyValid = false;
        keyError = 'API key is valid but access is forbidden. Your API key may need to be activated. Visit https://openweathermap.org/api';
      } else {
        keyValid = false;
        keyError = `API key test failed: ${error.response?.data?.message || error.message}`;
      }
    }
  }

  res.json({
    success: true,
    configured,
    keyValid,
    keyError,
    message: !configured
      ? 'OpenWeatherMap API key is not configured. Add OPENWEATHER_API_KEY to .env file'
      : keyValid
        ? 'OpenWeatherMap API is configured and working'
        : keyError || 'API key is configured but validation failed'
  });
};
