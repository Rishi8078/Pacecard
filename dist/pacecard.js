// Progress Circle Component
class ProgressCircle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.progress = 0;
    this.color = '#4CAF50';
    this.size = 90;
    this.strokeWidth = 6;
  }

  static get observedAttributes() {
    return ['progress', 'color', 'size', 'stroke-width'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'stroke-width') {
        this.strokeWidth = Number(newValue);
      } else if (name === 'progress') {
        this.progress = Number(newValue);
      } else {
        this[name] = newValue;
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const radius = (this.size - this.strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (this.progress / 100) * circumference;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
        }
        
        .progress-circle {
          transform: rotate(-90deg);
        }
        
        .progress-track {
          fill: none;
          stroke: rgba(255, 255, 255, 0.15);
        }
        
        .progress-bar {
          fill: none;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
      </style>
      
      <svg
        class="progress-circle"
        width="${this.size}"
        height="${this.size}"
        viewBox="0 0 ${this.size} ${this.size}"
      >
        <circle
          class="progress-track"
          cx="${this.size / 2}"
          cy="${this.size / 2}"
          r="${radius}"
          stroke-width="${this.strokeWidth}"
        />
        <circle
          class="progress-bar"
          cx="${this.size / 2}"
          cy="${this.size / 2}"
          r="${radius}"
          stroke-width="${this.strokeWidth}"
          stroke="${this.color}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${strokeDashoffset}"
        />
      </svg>
    `;
  }
}

// Main Pace Card Component
class PaceCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._timeRemaining = { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    this._expired = false;
    this._interval = null;
  }

  static getStubConfig() {
    return {
      type: 'custom:pace-card',
      title: 'Countdown Timer',
      target_date: '2024-12-31T23:59:59',
      creation_date: null,
      show_months: false,
      show_days: true,
      show_hours: true,
      show_minutes: true,
      show_seconds: true,
      color: '#ffffff',
      background_color: '#1976d2',
      progress_color: '#4CAF50',
      size: 'medium' // small, medium, large
    };
  }

  setConfig(config) {
    if (!config.target_date) {
      throw new Error('You need to define a target_date (can be a date string or entity ID)');
    }
    
    // If no creation_date is provided, set it to today (when card is created)
    if (!config.creation_date && !this._config.creation_date) {
      // Always use strict ISO format for cross-browser compatibility
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      config.creation_date = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }
    
    this._config = { ...config };
    this.render();
    this._startTimer();
  }

  set hass(hass) {
    this._hass = hass;
  }

  connectedCallback() {
    this._startTimer();
  }

  disconnectedCallback() {
    this._stopTimer();
  }

  _startTimer() {
    this._stopTimer();
    this._updateCountdown();
    this._interval = setInterval(() => {
      this._updateCountdown();
    }, 1000);
  }

  _stopTimer() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  // Helper for consistent date parsing across platforms
  _parseISODate(dateString) {
    try {
      // Handle ISO format strings properly (most reliable cross-platform)
      if (typeof dateString === 'string' && dateString.includes('T')) {
        // ISO format parsing is most consistent across browsers/devices
        const [datePart, timePart] = dateString.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        
        if (timePart && timePart.includes(':')) {
          const [hour, minute, secondPart] = timePart.split(':');
          const second = secondPart ? parseInt(secondPart) : 0;
          return new Date(year, month - 1, day, hour, minute, second).getTime();
        } else {
          return new Date(year, month - 1, day).getTime();
        }
      } else {
        // Fallback to regular parsing for other formats
        return new Date(dateString).getTime();
      }
    } catch (e) {
      console.error('Error parsing date:', e);
      return new Date(dateString).getTime();
    }
  }
  
  _updateCountdown() {
    if (!this._config.target_date) return;
    
    const now = new Date().getTime();
    const targetDateValue = this._getEntityValueOrString(this._config.target_date);
    if (!targetDateValue) return;
    
    // Use the helper method for consistent date parsing
    const targetDate = this._parseISODate(targetDateValue);
    
    const difference = targetDate - now;

    if (difference > 0) {
      // Calculate time units based on what's enabled - cascade disabled units into enabled ones
      const { show_months, show_days, show_hours, show_minutes, show_seconds } = this._config;
      
      let totalMilliseconds = difference;
      let months = 0, days = 0, hours = 0, minutes = 0, seconds = 0;
      
      // Find the largest enabled unit and calculate everything from there
      if (show_months) {
        // Normal calculation when months are enabled
        months = Math.floor(totalMilliseconds / (1000 * 60 * 60 * 24 * 30.44));
        totalMilliseconds = totalMilliseconds % (1000 * 60 * 60 * 24 * 30.44);
        
        if (show_days) {
          days = Math.floor(totalMilliseconds / (1000 * 60 * 60 * 24));
          totalMilliseconds = totalMilliseconds % (1000 * 60 * 60 * 24);
        }
        
        if (show_hours) {
          hours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
          totalMilliseconds = totalMilliseconds % (1000 * 60 * 60);
        }
        
        if (show_minutes) {
          minutes = Math.floor(totalMilliseconds / (1000 * 60));
          totalMilliseconds = totalMilliseconds % (1000 * 60);
        }
        
        if (show_seconds) {
          seconds = Math.floor(totalMilliseconds / 1000);
        }
      } else if (show_days) {
        // Months disabled - put everything into days and below
        days = Math.floor(totalMilliseconds / (1000 * 60 * 60 * 24));
        totalMilliseconds = totalMilliseconds % (1000 * 60 * 60 * 24);
        
        if (show_hours) {
          hours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
          totalMilliseconds = totalMilliseconds % (1000 * 60 * 60);
        }
        
        if (show_minutes) {
          minutes = Math.floor(totalMilliseconds / (1000 * 60));
          totalMilliseconds = totalMilliseconds % (1000 * 60);
        }
        
        if (show_seconds) {
          seconds = Math.floor(totalMilliseconds / 1000);
        }
      } else if (show_hours) {
        // Days and months disabled - put everything into hours and below
        hours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
        totalMilliseconds = totalMilliseconds % (1000 * 60 * 60);
        
        if (show_minutes) {
          minutes = Math.floor(totalMilliseconds / (1000 * 60));
          totalMilliseconds = totalMilliseconds % (1000 * 60);
        }
        
        if (show_seconds) {
          seconds = Math.floor(totalMilliseconds / 1000);
        }
      } else if (show_minutes) {
        // Only minutes and possibly seconds enabled
        minutes = Math.floor(totalMilliseconds / (1000 * 60));
        totalMilliseconds = totalMilliseconds % (1000 * 60);
        
        if (show_seconds) {
          seconds = Math.floor(totalMilliseconds / 1000);
        }
      } else if (show_seconds) {
        // Only seconds enabled
        seconds = Math.floor(totalMilliseconds / 1000);
      }

      this._timeRemaining = { months, days, hours, minutes, seconds, total: difference };
      this._expired = false;
    } else {
      this._timeRemaining = { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
      this._expired = true;
    }
    
    this._updateDisplay();
  }

  _updateDisplay() {
    const progressCircle = this.shadowRoot.querySelector('progress-circle');
    const mainValue = this.shadowRoot.querySelector('.main-value');
    const mainLabel = this.shadowRoot.querySelector('.main-label');
    const subtitle = this.shadowRoot.querySelector('.subtitle');
    const card = this.shadowRoot.querySelector('.card');
    
    if (progressCircle) {
      progressCircle.setAttribute('progress', this._getProgress());
    }
    
    const mainDisplay = this._getMainDisplay();
    if (mainValue) mainValue.textContent = mainDisplay.value;
    if (mainLabel) mainLabel.textContent = mainDisplay.label;
    
    if (subtitle) {
      subtitle.textContent = this._getSubtitle();
    }
    
    if (card) {
      card.classList.toggle('expired', this._expired);
    }
  }

  _getProgress() {
    const targetDateValue = this._getEntityValueOrString(this._config.target_date);
    if (!targetDateValue) return 0;
    
    // Use the helper method for consistent date parsing
    const targetDate = this._parseISODate(targetDateValue);
    const now = Date.now();
    
    let creationDate;
    if (this._config.creation_date) {
      const creationDateValue = this._getEntityValueOrString(this._config.creation_date);
      
      if (creationDateValue) {
        // Use the helper method for consistent date parsing
        creationDate = this._parseISODate(creationDateValue);
      } else {
        creationDate = now;
      }
    } else {
      creationDate = now; // Fallback to now if somehow no creation date
    }
    
    const totalDuration = targetDate - creationDate;
    if (totalDuration <= 0) return 100;
    
    const elapsed = now - creationDate;
    const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    
    return this._expired ? 100 : progress;
  }

  _getEntityValueOrString(value) {
    if (!value) return null;
    
    if (typeof value === 'string' && value.includes('.') && this._hass && this._hass.states[value]) {
      const entity = this._hass.states[value];
      return entity.state;
    }
    
    return value;
  }

  _getMainDisplay() {
    const { show_months, show_days, show_hours, show_minutes, show_seconds } = this._config;
    const { months, days, hours, minutes, seconds } = this._timeRemaining;
    
    if (this._expired) {
      return { value: '🎉', label: 'Completed!' };
    }
    
    // Show the largest time unit that is enabled and has a value > 0
    if (show_months && months > 0) {
      return { value: months.toString(), label: months === 1 ? 'month left' : 'months left' };
    } else if (show_days && days > 0) {
      return { value: days.toString(), label: days === 1 ? 'day left' : 'days left' };
    } else if (show_hours && hours > 0) {
      return { value: hours.toString(), label: hours === 1 ? 'hour left' : 'hours left' };
    } else if (show_minutes && minutes > 0) {
      return { value: minutes.toString(), label: minutes === 1 ? 'minute left' : 'minutes left' };
    } else if (show_seconds && seconds >= 0) {
      return { value: seconds.toString(), label: seconds === 1 ? 'second left' : 'seconds left' };
    }
    
    return { value: '0', label: 'seconds left' };
  }

    _getSubtitle() {
    if (this._expired) return 'Timer has expired';
    
    const { months, days, hours, minutes, seconds } = this._timeRemaining;
    const { show_months, show_days, show_hours, show_minutes, show_seconds } = this._config;
    
    const parts = [];
    
    // Add each time unit based on configuration and if value > 0
    if (show_months && months > 0) {
      parts.push({ value: months, unit: months === 1 ? 'month' : 'months' });
    }
    
    if (show_days && days > 0) {
      parts.push({ value: days, unit: days === 1 ? 'day' : 'days' });
    }
    
    if (show_hours && hours > 0) {
      parts.push({ value: hours, unit: hours === 1 ? 'hour' : 'hours' });
    }
    
    if (show_minutes && minutes > 0) {
      parts.push({ value: minutes, unit: minutes === 1 ? 'minute' : 'minutes' });
    }
    
    if (show_seconds && seconds > 0) {
      parts.push({ value: seconds, unit: seconds === 1 ? 'second' : 'seconds' });
    }
    
    // If no parts are shown or all values are 0, show the largest enabled unit
    if (parts.length === 0) {
      if (show_months) {
        parts.push({ value: months, unit: months === 1 ? 'month' : 'months' });
      } else if (show_days) {
        parts.push({ value: days, unit: days === 1 ? 'day' : 'days' });
      } else if (show_hours) {
        parts.push({ value: hours, unit: hours === 1 ? 'hour' : 'hours' });
      } else if (show_minutes) {
        parts.push({ value: minutes, unit: minutes === 1 ? 'minute' : 'minutes' });
      } else if (show_seconds) {
        parts.push({ value: seconds, unit: seconds === 1 ? 'second' : 'seconds' });
      }
    }
    
    // Count enabled units for formatting decision
    const enabledUnits = [show_months, show_days, show_hours, show_minutes, show_seconds].filter(Boolean).length;
    
    // Format based on number of enabled units
    if (enabledUnits <= 2 && parts.length > 0) {
      // Natural format for 1-2 enabled units: "1 month and 10 days"
      if (parts.length === 1) {
        return `${parts[0].value} ${parts[0].unit}`;
      } else if (parts.length === 2) {
        return `${parts[0].value} ${parts[0].unit} and ${parts[1].value} ${parts[1].unit}`;
      }
    }
    
    // Compact format for 3+ enabled units: "1mo 10d 5h"
    return parts.map(part => {
      const shortUnit = part.unit.charAt(0); // m, d, h, m, s
      return `${part.value}${shortUnit}`;
    }).join(' ') || '0s';
  }

  _applyCardMod() {
    // Card-mod compatibility is handled by adding ha-card class to root element
    // This allows card-mod to automatically apply styles
  }

  render() {
    const {
      title = 'Countdown Timer',
      show_days = true,
      show_hours = true,
      show_minutes = true,
      show_seconds = true,
      color = '#ffffff',
      background_color,
      progress_color,
      size = 'medium',
      expired_text = 'Completed! 🎉'
    } = this._config;

    const bgColor = background_color || '#1976d2';
    const progressColor = progress_color || '#4CAF50';

    const sizeClasses = {
      small: 'size-small',
      medium: 'size-medium',
      large: 'size-large'
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        }
        
        .card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 20px;
          border-radius: 22px;
          position: relative;
          overflow: hidden;
          background: ${bgColor};
          color: ${color};
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          border: none;
          aspect-ratio: 2:1;
        }
        
        .card.size-small {
          min-height: 100px;
          max-height: 150px;
          padding: 16px;
        }
        
        .card.size-medium {
          min-height: 120px;
          max-height: 200px;
          padding: 20px;
        }
        
        .card.size-large {
          min-height: 140px;
          max-height: 250px;
          padding: 24px;
        }
        
        /* CLEAN HEADER SECTION - Like reference cards */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0;
        }
        
        .title-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        /* IMPROVED TYPOGRAPHY - Matching reference cards */
        .title {
          font-size: 2rem;
          font-weight: 500;
          margin: 0;
          opacity: 0.9;
          line-height: 1.3;
          letter-spacing: -0.01em;
        }
        
        .subtitle {
          font-size: 1.6rem;
          opacity: 0.65;
          margin: 0;
          font-weight: 400;
          line-height: 1.2;
        }
        
        .progress-section {
          flex-shrink: 0;
          margin-left: auto;
        }
        
        /* CONTENT SECTION - Like reference cards bottom area */
        .content {
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          margin-top: auto;
          padding-top: 12px;
        }
        
        .expired {
          animation: celebration 0.8s ease-in-out;
        }
        
        @keyframes celebration {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        
        .progress-circle {
          opacity: 0.9;
        }
        
        /* Responsive design */
        @media (max-width: 480px) {
          .card {
            padding: 16px;
            border-radius: 22px;
          }
          
          .title {
            font-size: 1rem;
          }
          
          .main-value {
            font-size: 2rem;
          }
          
          .subtitle {
            font-size: 0.8rem;
          }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .card {
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          }
        }
      </style>
      
      <div class="card pace-card ha-card ${sizeClasses[size]} ${this._expired ? 'expired' : ''}">
        <div class="header">
          <div class="title-section">
            <h2 class="title">${this._expired ? expired_text : title}</h2>
            <p class="subtitle">${this._getSubtitle()}</p>
          </div>
        </div>
        
        <div class="content">
          <div class="progress-section">
            <progress-circle
              class="progress-circle"
              progress="${this._getProgress()}"
              color="${progressColor}"
              size="100"
              stroke-width="15"
            ></progress-circle>
          </div>
        </div>
      </div>
    `;
    
    setTimeout(() => {
      this._updateDisplay();
      this._applyCardMod();
    }, 0);
  }

  getCardSize() {
    const size = this._config.size || 'medium';
    return size === 'small' ? 2 : size === 'large' ? 4 : 3;
  }

  static get version() {
    return '3.0.0';
  }
}

// Register custom elements
customElements.define('progress-circle', ProgressCircle);
customElements.define('pace-card', PaceCard);

// Register the card
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'pace-card',
  name: 'Pace Card',
  description: 'A beautiful countdown timer card with progress circle for Home Assistant',
  preview: true,
  documentationURL: 'https://github.com/Rishi8078/Pacecard'
});

console.info(
  `%c  PACE-CARD  \n%c  Version ${PaceCard.version}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray'
);