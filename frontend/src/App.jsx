import React, { useState, useEffect, useRef } from 'react';
import { Button, TextField, Box, Typography, Paper, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Sample data for layers
const DEFAULT_LAYERS = {
  food: [
    { id: 1, name: 'Pizza Place', position: [25.034, 121.564] },
    { id: 2, name: 'Sushi Bar', position: [25.035, 121.565] },
  ],
  playground: [
    { id: 1, name: 'Central Playground', position: [25.033, 121.563] },
    { id: 2, name: 'Riverside Park', position: [25.032, 121.566] },
  ],
};

const LOCAL_STORAGE_KEY = 'map_layers_v1';

// Fix leaflet's default icon path
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function UserMarker({ onAdd, userMarker, userMarkerRemoved, onRemoved }) {
  useMapEvents({
    click(e) {
      if (userMarkerRemoved) {
        onRemoved(false); // reset flag
        return;
      }
      if (!userMarker) {
        onAdd(e.latlng);
      }
    },
  });
  return null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [view, setView] = useState(() => localStorage.getItem('token') ? 'map' : 'login'); // 'login', 'register', 'map'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [position, setPosition] = useState(null);
  const [locating, setLocating] = useState(false);
  const [layerData, setLayerData] = useState(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_LAYERS;
  });
  const [layer, setLayer] = useState('food');
  const [newLayer, setNewLayer] = useState('');
  const layerKeys = Object.keys(layerData);
  const [userMarker, setUserMarker] = useState(null);
  const [search, setSearch] = useState('');
  const [searchMarker, setSearchMarker] = useState(null);
  const [searchName, setSearchName] = useState('');
  const [userMarkerName, setUserMarkerName] = useState('My Marker');
  const mapRef = useRef();
  const [editingLayer, setEditingLayer] = useState(null);
  const [editingLayerName, setEditingLayerName] = useState('');
  const [userMarkerRemoved, setUserMarkerRemoved] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      localStorage.setItem('token', data.token);
      setView('map');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      setView('login');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLayerChange = (event, newLayer) => {
    if (newLayer) setLayer(newLayer);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search) return;
    // Use OpenStreetMap Nominatim API
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      setSearchMarker([lat, lon]);
      setSearchName(data[0].display_name);
      // Center map
      if (mapRef.current) {
        mapRef.current.setView([lat, lon], 16);
      }
    } else {
      setSearchMarker(null);
      setSearchName('');
      alert('Place not found');
    }
  };

  const handleAddToLayer = () => {
    if (searchMarker && searchName) {
      setLayerData(prev => ({
        ...prev,
        [layer]: [
          ...prev[layer],
          {
            id: Date.now(),
            name: searchName,
            position: searchMarker,
          },
        ],
      }));
      setSearchMarker(null);
      setSearchName('');
      setSearch('');
    }
  };

  const handleRemoveSearchMarker = () => {
    setSearchMarker(null);
    setSearchName('');
    setSearch('');
  };

  const handleAddLayer = () => {
    const key = newLayer.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key || layerKeys.includes(key) || layerKeys.length >= 10) return;
    setLayerData(prev => ({ ...prev, [key]: [] }));
    setLayer(key);
    setNewLayer('');
  };

  const handleRemoveLayerMarker = (id) => {
    setLayerData(prev => ({
      ...prev,
      [layer]: prev[layer].filter(item => item.id !== id)
    }));
  };

  const handleAddUserMarkerToLayer = () => {
    if (userMarker) {
      setLayerData(prev => ({
        ...prev,
        [layer]: [
          ...prev[layer],
          {
            id: Date.now(),
            name: userMarkerName || 'My Marker',
            position: userMarker,
          },
        ],
      }));
      setUserMarker(null);
      setUserMarkerName('My Marker');
    }
  };

  const handleStartEditLayer = (key) => {
    setEditingLayer(key);
    setEditingLayerName(key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '));
  };

  const handleSaveEditLayer = (key) => {
    const newKey = editingLayerName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!newKey || layerKeys.includes(newKey)) return;
    setLayerData(prev => {
      const {[key]: oldLayer, ...rest} = prev;
      return { ...rest, [newKey]: oldLayer };
    });
    if (layer === key) setLayer(newKey);
    setEditingLayer(null);
    setEditingLayerName('');
  };

  const handleCancelEditLayer = () => {
    setEditingLayer(null);
    setEditingLayerName('');
  };

  const handleCopyLayer = () => {
    const currentLayerName = layerKeys.find(key => key === layer);
    if (!currentLayerName) return;
    const copyName = `COPY of ${currentLayerName.charAt(0).toUpperCase() + currentLayerName.slice(1).replace(/_/g, ' ')}`;
    const copyKey = copyName.trim().toLowerCase().replace(/\s+/g, '_');
    let newLayerData = { ...layerData };
    let newLayerKeys = Object.keys(newLayerData);
    if (newLayerKeys.length >= 10) {
      // Remove the last layer
      const lastKey = newLayerKeys[newLayerKeys.length - 1];
      delete newLayerData[lastKey];
      newLayerKeys = Object.keys(newLayerData);
    }
    newLayerData[copyKey] = [...layerData[layer]];
    setLayerData(newLayerData);
    setLayer(copyKey);
  };

  const handleDeleteLayer = (key) => {
    if (layerKeys.length === 1) return; // Prevent deleting last layer
    setLayerData(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
    if (layer === key) {
      // Switch to first available layer
      const newKeys = layerKeys.filter(k => k !== key);
      setLayer(newKeys[0]);
    }
  };

  useEffect(() => {
    if (view === 'map') {
      setLocating(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setPosition([pos.coords.latitude, pos.coords.longitude]);
            setLocating(false);
          },
          () => {
            setLocating(false);
          }
        );
      } else {
        setLocating(false);
      }
    }
  }, [view]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(layerData));
  }, [layerData]);

  if (view === 'map') {
    const handleSignOut = () => {
      localStorage.removeItem('token');
      setView('login');
    };
    return (
      <Box sx={{ p: 0, m: 0, width: '100vw', maxWidth: '100vw' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pl: 2, pr: 2, pt: 2 }}>
          <Typography variant="h4" gutterBottom>Map</Typography>
          <Button variant="outlined" color="secondary" onClick={handleSignOut}>Sign Out</Button>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 2, pr: 2, mb: 2 }}>
          <form onSubmit={handleSearch} style={{ width: '100%', display: 'flex', gap: 8 }}>
            <TextField
              label="Search for a place"
              variant="outlined"
              size="small"
              value={search}
              onChange={e => setSearch(e.target.value)}
              fullWidth
            />
            <Button type="submit" variant="contained">Search</Button>
          </form>
        </Box>
        {searchMarker && (
          <Box sx={{ display: 'flex', gap: 2, pl: 2, mb: 2 }}>
            <Button variant="contained" color="success" onClick={handleAddToLayer}>Add to Layer</Button>
            <Button variant="outlined" color="error" onClick={handleRemoveSearchMarker}>Remove</Button>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 2, mb: 2, gap: 1 }}>
          <TextField
            label="Add Layer"
            size="small"
            value={newLayer}
            onChange={e => setNewLayer(e.target.value)}
            disabled={layerKeys.length >= 10}
            sx={{ width: 180 }}
          />
          <Button
            variant="outlined"
            onClick={handleAddLayer}
            disabled={!newLayer.trim() || layerKeys.includes(newLayer.trim().toLowerCase().replace(/\s+/g, '_')) || layerKeys.length >= 10}
          >
            Add
          </Button>
          <Typography variant="caption" color={layerKeys.length >= 10 ? 'error' : 'textSecondary'}>
            {layerKeys.length}/10 layers
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            value={layer}
            exclusive
            onChange={handleLayerChange}
            sx={{ mb: 2, pl: 2 }}
          >
            {layerKeys.map(key => (
              <ToggleButton key={key} value={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {editingLayer === key ? (
                  <>
                    <TextField
                      value={editingLayerName}
                      onChange={e => setEditingLayerName(e.target.value)}
                      size="small"
                      sx={{ width: 100 }}
                      autoFocus
                    />
                    <Button size="small" onClick={() => handleSaveEditLayer(key)} disabled={!editingLayerName.trim() || layerKeys.includes(editingLayerName.trim().toLowerCase().replace(/\s+/g, '_'))}><SaveIcon fontSize="small" /></Button>
                    <Button size="small" onClick={handleCancelEditLayer}><CloseIcon fontSize="small" /></Button>
                  </>
                ) : (
                  <>
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
                    <Button size="small" onClick={e => { e.stopPropagation(); handleStartEditLayer(key); }}><EditIcon fontSize="small" /></Button>
                    {layer === key && (
                      <Button size="small" onClick={e => { e.stopPropagation(); handleCopyLayer(); }}><ContentCopyIcon fontSize="small" /></Button>
                    )}
                    {layerKeys.length > 1 && (
                      <Button size="small" color="error" onClick={e => { e.stopPropagation(); handleDeleteLayer(key); }}><DeleteIcon fontSize="small" /></Button>
                    )}
                  </>
                )}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        {locating && <Typography sx={{ pl: 2 }}>Locating...</Typography>}
        <Box sx={{ height: '80vh', width: '100vw', maxWidth: '100vw', mt: 2 }}>
          <MapContainer
            center={position || [25.033964, 121.564468]}
            zoom={15}
            style={{ height: '100%', width: '100vw', maxWidth: '100vw' }}
            whenCreated={mapInstance => { mapRef.current = mapInstance; }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {position && (
              <>
                <Marker position={position}>
                  <Popup>Your current location</Popup>
                </Marker>
                <Circle
                  center={position}
                  radius={20}
                  pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.5 }}
                />
              </>
            )}
            {layerData[layer].map(item => (
              <Marker key={item.id} position={item.position}>
                <Popup>
                  <Box>
                    <Typography>{item.name}</Typography>
                    <Button size="small" color="error" onClick={() => handleRemoveLayerMarker(item.id)}>
                      Remove
                    </Button>
                  </Box>
                </Popup>
              </Marker>
            ))}
            {userMarker && (
              <Marker position={userMarker}>
                <Popup>
                  <Box sx={{ minWidth: 180 }}>
                    <TextField
                      label="Marker Name"
                      size="small"
                      value={userMarkerName}
                      onChange={e => setUserMarkerName(e.target.value)}
                      fullWidth
                      sx={{ mb: 1 }}
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" color="success" onClick={handleAddUserMarkerToLayer}>
                        Add to Layer
                      </Button>
                      <Button size="small" color="error" onClick={() => { setUserMarker(null); setUserMarkerName('My Marker'); setUserMarkerRemoved(true); }}>
                        Remove
                      </Button>
                    </Box>
                  </Box>
                </Popup>
              </Marker>
            )}
            {searchMarker && (
              <Marker position={searchMarker}>
                <Popup>{searchName}</Popup>
              </Marker>
            )}
            <UserMarker onAdd={setUserMarker} userMarker={userMarker} userMarkerRemoved={userMarkerRemoved} onRemoved={setUserMarkerRemoved} />
          </MapContainer>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <Paper sx={{ p: 4, minWidth: 320 }}>
        <Typography variant="h5" gutterBottom>
          {view === 'login' ? 'Login' : 'Register'}
        </Typography>
        {error && <Typography color="error">{error}</Typography>}
        <form onSubmit={view === 'login' ? handleLogin : handleRegister}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            fullWidth
            margin="normal"
            required
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            fullWidth
            margin="normal"
            required
          />
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>
            {view === 'login' ? 'Login' : 'Register'}
          </Button>
        </form>
        <Button
          onClick={() => { setView(view === 'login' ? 'register' : 'login'); setError(''); }}
          color="secondary"
          sx={{ mt: 2 }}
        >
          {view === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
        </Button>
      </Paper>
    </Box>
  );
}

export default App;
