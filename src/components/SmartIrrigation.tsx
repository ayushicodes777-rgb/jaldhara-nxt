import { useState } from 'react';

export default function SmartIrrigation() {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <button onClick={() => setVisible(!visible)}>
        {visible ? 'Close Smart Irrigation' : 'Open Smart Irrigation'}
      </button>

      {visible && (
        <div>
          <h2>Smart Irrigation</h2>
          <p>Soil Moisture: --%</p>
          <p>Pump Status: --</p>
          <button>Toggle Pump</button>
        </div>
      )}
    </div>
  );
}
