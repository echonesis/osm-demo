import React, { useState, useEffect, useRef } from 'react';
import { Button, TextField, Box, Typography, Paper, ToggleButton, ToggleButtonGroup, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

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
  const [layerData, setLayerData] = useState({});
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
  const [mapCentered, setMapCentered] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [shareRequester, setShareRequester] = useState(null);
  const [friendPosition, setFriendPosition] = useState(null);
  const [linkedFriend, setLinkedFriend] = useState(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [pendingRequester, setPendingRequester] = useState(null);
  const [showApprovedDialog, setShowApprovedDialog] = useState(false);
  const [approvedBy, setApprovedBy] = useState('');
  const [approvedByPosition, setApprovedByPosition] = useState(null);
  const [connectedFriends, setConnectedFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState('');

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

  // Helper to get token
  const getToken = () => localStorage.getItem('token');

  // Fetch layers from backend after login
  useEffect(() => {
    if (view === 'map' && getToken()) {
      fetch(`${API_URL}/api/layers`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
        .then(res => res.json())
        .then(data => {
          setLayerData(data);
          const keys = Object.keys(data);
          if (keys.length > 0 && !keys.includes(layer)) {
            setLayer(keys[0]);
          }
        })
        .catch(err => console.error('Failed to fetch layers:', err));
      setMapCentered(false); // Reset map centering on login
    }
  }, [view]);

  // Center map on user position after login (only once)
  useEffect(() => {
    if (view === 'map' && position && mapRef.current && !mapCentered) {
      mapRef.current.setView(position, 15);
      setMapCentered(true);
    }
  }, [view, position, mapCentered]);

  // Save layers to backend whenever layerData changes (but only if on map view)
  useEffect(() => {
    if (view === 'map' && getToken()) {
      fetch(`${API_URL}/api/layers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(layerData)
      }).catch(err => console.error('Failed to save layers:', err));
    }
  }, [layerData, view]);

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

  // Add continuous position tracking every 5 seconds
  useEffect(() => {
    if (view === 'map' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
        },
        (error) => {
          console.log('Position tracking error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000 // Update every 5 seconds
        }
      );

      // Cleanup function to stop watching when component unmounts or view changes
      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [view]);

  // Poll for notifications every 5 seconds
  useEffect(() => {
    if (view === 'map' && getToken()) {
      const interval = setInterval(() => {
        fetch(`${API_URL}/api/notifications`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
          .then(res => res.json())
          .then(async notes => {
            setNotifications(notes);
            // If a link request is present, set the requester and show dialog
            const req = notes.find(n => n.includes('wants to link'));
            if (req) {
              const requester = req.split(' ')[0];
              setPendingRequester(requester);
              setShowLinkDialog(true);
            }
            // If an approval is present, show approval dialog and fetch position
            const approval = notes.find(n => n.includes('approved your request'));
            if (approval) {
              const approver = approval.split(' ')[0];
              setApprovedBy(approver);
              setShowApprovedDialog(true);
              // Fetch position from backend
              try {
                const res = await fetch(`${API_URL}/api/friend-position?friendEmail=${approver}`, {
                  headers: { 'Authorization': `Bearer ${getToken()}` }
                });
                const data = await res.json();
                setApprovedByPosition(data.position);
                setFriendPosition(data.position); // Show on map immediately
                setSelectedFriend(approver); // Select in dropdown
                // Add to connected friends if not already present
                setConnectedFriends(prev => prev.includes(approver) ? prev : [...prev, approver]);
              } catch {
                setApprovedByPosition(null);
              }
            }
          })
          .catch(() => {});
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [view]);

  // When selecting a friend from dropdown, fetch their position
  useEffect(() => {
    if (view === 'map' && selectedFriend && getToken()) {
      fetch(`${API_URL}/api/friend-position?friendEmail=${selectedFriend}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
        .then(res => res.json())
        .then(data => setFriendPosition(data.position))
        .catch(() => setFriendPosition(null));
    }
  }, [view, selectedFriend]);

  // Accept link and start sharing position
  const handleStartSharing = async () => {
    setIsSharing(true);
    await fetch(`${API_URL}/api/share-position`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ toEmail: pendingRequester, position, sharing: true })
    });
    setShowLinkDialog(false);
    setPendingRequester(null);
  };

  // Reject link request
  const handleRejectLink = () => {
    setShowLinkDialog(false);
    setPendingRequester(null);
  };

  // Poll for friend's position every 5 seconds if linked
  useEffect(() => {
    let interval;
    if (view === 'map' && linkedFriend && getToken()) {
      const fetchFriendPos = () => {
        fetch(`${API_URL}/api/friend-position?friendEmail=${linkedFriend}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
          .then(res => res.json())
          .then(data => setFriendPosition(data.position))
          .catch(() => setFriendPosition(null));
      };
      fetchFriendPos();
      interval = setInterval(fetchFriendPos, 5000);
    }
    return () => interval && clearInterval(interval);
  }, [view, linkedFriend]);

  // Send link request
  const handleLinkRequest = async () => {
    if (!friendEmail) return;
    const res = await fetch(`${API_URL}/api/link-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ toEmail: friendEmail })
    });
    const data = await res.json();
    alert(data.message);
    setFriendEmail('');
  };

  // Continuously update shared position if sharing is active
  useEffect(() => {
    let interval;
    if (isSharing && pendingRequester && position && getToken()) {
      const sendPosition = () => {
        fetch(`${API_URL}/api/share-position`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({ toEmail: pendingRequester, position, sharing: true })
        });
      };
      sendPosition();
      interval = setInterval(sendPosition, 5000);
    }
    return () => interval && clearInterval(interval);
  }, [isSharing, pendingRequester, position]);

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
        {/* Link My Friends UI - directly below header */}
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 2, mb: 2, gap: 1 }}>
          <TextField
            label="Link My Friends (type email)"
            size="small"
            value={friendEmail}
            onChange={e => setFriendEmail(e.target.value)}
            sx={{ width: 220 }}
          />
          <Button variant="contained" onClick={handleLinkRequest} disabled={!friendEmail}>
            Link
          </Button>
        </Box>
        {/* Friend List Dropdown (like Layer Select) - directly below Link My Friends */}
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 2, mb: 2, gap: 1 }}>
          <Typography sx={{ mr: 1 }}>Friend List:</Typography>
          <Select
            value={selectedFriend}
            onChange={e => setSelectedFriend(e.target.value)}
            displayEmpty
            sx={{ minWidth: 220 }}
            disabled={connectedFriends.length === 0}
          >
            <MenuItem value="" disabled>
              {connectedFriends.length === 0 ? 'No friends connected' : 'Select a friend'}
            </MenuItem>
            {connectedFriends.map(email => (
              <MenuItem key={email} value={email}>{email}</MenuItem>
            ))}
          </Select>
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
            label="Create a New Layer"
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
        
        {/* Layer Selection Dropdown */}
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 2, mb: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Select Layer</InputLabel>
            <Select
              value={layer}
              label="Select Layer"
              onChange={(e) => setLayer(e.target.value)}
            >
              {layerKeys.map(key => (
                <MenuItem key={key} value={key}>
                  {key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Layer Management Functions */}
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 2, mb: 2, gap: 1 }}>
          {editingLayer === layer ? (
            <>
              <TextField
                value={editingLayerName}
                onChange={e => setEditingLayerName(e.target.value)}
                size="small"
                sx={{ width: 150 }}
                autoFocus
                label="New Layer Name"
              />
              <Button component="span" size="small" variant="contained" onClick={() => handleSaveEditLayer(layer)} disabled={!editingLayerName.trim() || layerKeys.includes(editingLayerName.trim().toLowerCase().replace(/\s+/g, '_'))}>
                <SaveIcon fontSize="small" /> Save
              </Button>
              <Button component="span" size="small" variant="outlined" onClick={handleCancelEditLayer}>
                <CloseIcon fontSize="small" /> Cancel
              </Button>
            </>
          ) : (
            <>
              <Button component="span" size="small" variant="outlined" onClick={() => handleStartEditLayer(layer)}>
                <EditIcon fontSize="small" /> Modify Layer Name
              </Button>
              <Button component="span" size="small" variant="outlined" onClick={handleCopyLayer}>
                <ContentCopyIcon fontSize="small" /> Copy Layer
              </Button>
              {layerKeys.length > 1 && (
                <Button component="span" size="small" variant="outlined" color="error" onClick={() => handleDeleteLayer(layer)}>
                  <DeleteIcon fontSize="small" /> Delete Layer
                </Button>
              )}
            </>
          )}
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
                <Circle
                  center={position}
                  radius={20}
                  pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.5 }}
                />
              </>
            )}
            {/* Show friend's position as blue circle (rendered after red circle) */}
            {view === 'map' && friendPosition && (
              <Circle
                center={friendPosition}
                radius={20}
                pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.5 }}
              />
            )}
            {Array.isArray(layerData[layer]) && layerData[layer].map(item => (
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
            {/* Notification for incoming link request is now handled by Dialog */}
          </MapContainer>
        </Box>
        {/* Link Request Modal */}
        <Dialog open={showLinkDialog} onClose={handleRejectLink}>
          <DialogTitle>Friend Link Request</DialogTitle>
          <DialogContent>
            <Typography>{pendingRequester} is trying to connect with you.</Typography>
          </DialogContent>
          <DialogActions>
            <Button variant="contained" color="primary" onClick={handleStartSharing}>Share My Position</Button>
            <Button variant="outlined" color="error" onClick={handleRejectLink}>Reject Connecting</Button>
          </DialogActions>
        </Dialog>
        {/* Approved Notification Modal */}
        <Dialog open={showApprovedDialog} onClose={() => setShowApprovedDialog(false)}>
          <DialogTitle>Friend Connected</DialogTitle>
          <DialogContent>
            <Typography>{approvedBy} approved your request</Typography>
            {approvedByPosition && (
              <Typography sx={{ mt: 1 }}>{approvedBy} position: [{approvedByPosition[0]}, {approvedByPosition[1]}]</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={() => setShowApprovedDialog(false)}>OK</Button>
          </DialogActions>
        </Dialog>
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
