class HotelBookingApp {
    constructor() {
        this.baseUrl = '/api';
        this.currentUser = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkServices();
        this.loadCities();
        
        // Check if user is already logged in
        const token = localStorage.getItem('token');
        if (token) {
            this.validateToken(token);
        }
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                this.switchView(view);
            });
        });

        // Auth buttons
        document.getElementById('loginBtn').addEventListener('click', () => this.showLoginModal());
        document.getElementById('registerBtn').addEventListener('click', () => this.showRegisterModal());

        // Forms
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        // Hotel search
        document.getElementById('hotelSearch').addEventListener('input', 
            this.debounce(() => this.searchHotels(), 500));

        // Modals close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                modal.classList.remove('active');
            });
        });

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async checkServices() {
        const services = [
            { id: 'usersServiceStatus', name: 'Users', url: '/api/users/health' },
            { id: 'hotelsServiceStatus', name: 'Hotels', url: '/api/hotels/health' },
            { id: 'bookingsServiceStatus', name: 'Bookings', url: '/api/bookings/health' },
            { id: 'gatewayStatus', name: 'Gateway', url: '/health' }
        ];

        for (const service of services) {
            try {
                const response = await fetch(service.url);
                const element = document.getElementById(service.id);
                const statusBadge = element.querySelector('.status-badge');
                
                if (response.ok) {
                    statusBadge.textContent = 'Healthy';
                    statusBadge.className = 'status-badge healthy';
                } else {
                    throw new Error('Service not healthy');
                }
            } catch (error) {
                const element = document.getElementById(service.id);
                const statusBadge = element.querySelector('.status-badge');
                statusBadge.textContent = 'Unhealthy';
                statusBadge.className = 'status-badge unhealthy';
            }
        }
    }

    async loadCities() {
        try {
            const response = await fetch('/api/hotels/cities/available');
            if (response.ok) {
                const data = await response.json();
                const select = document.getElementById('cityFilter');
                
                data.cities.forEach(city => {
                    const option = document.createElement('option');
                    option.value = city;
                    option.textContent = city;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load cities:', error);
        }
    }

    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.view === view);
        });

        // Hide all views
        document.querySelectorAll('.view').forEach(viewElement => {
            viewElement.classList.remove('active');
        });

        // Show selected view
        document.getElementById(`${view}-view`).classList.add('active');

        // Load data for the view
        switch(view) {
            case 'hotels':
                this.searchHotels();
                break;
            case 'bookings':
                if (this.currentUser) {
                    this.loadBookings();
                } else {
                    this.showNotification('Please login to view bookings', 'info');
                    this.showLoginModal();
                }
                break;
            case 'profile':
                if (this.currentUser) {
                    this.loadProfile();
                } else {
                    this.showNotification('Please login to view profile', 'info');
                    this.showLoginModal();
                }
                break;
        }
    }

    async searchHotels() {
        try {
            const search = document.getElementById('hotelSearch').value;
            const city = document.getElementById('cityFilter').value;
            const minPrice = document.getElementById('minPrice').value;
            const maxPrice = document.getElementById('maxPrice').value;
            const rating = document.getElementById('ratingFilter').value;

            let url = '/api/hotels/search?';
            const params = [];

            if (search) params.push(`query=${encodeURIComponent(search)}`);
            if (city) params.push(`city=${encodeURIComponent(city)}`);
            if (minPrice) params.push(`minPrice=${minPrice}`);
            if (maxPrice) params.push(`maxPrice=${maxPrice}`);
            if (rating) params.push(`rating=${rating}`);

            url += params.join('&');

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch hotels');

            const data = await response.json();
            this.renderHotels(data.hotels);
        } catch (error) {
            console.error('Search hotels error:', error);
            this.showNotification('Failed to load hotels', 'error');
        }
    }

    renderHotels(hotels) {
        const container = document.getElementById('hotelsList');
        
        if (!hotels || hotels.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No hotels found</h3>
                    <p>Try adjusting your search criteria</p>
                </div>
            `;
            return;
        }

        let html = '';
        hotels.forEach(hotel => {
            const ratingStars = '★'.repeat(Math.floor(hotel.rating)) + '☆'.repeat(5 - Math.floor(hotel.rating));
            
            html += `
                <div class="hotel-card">
                    <div class="hotel-image">
                        <i class="fas fa-hotel"></i>
                    </div>
                    <div class="hotel-content">
                        <h3>${this.escapeHtml(hotel.name)}</h3>
                        <div class="hotel-location">
                            <i class="fas fa-map-marker-alt"></i>
                            ${this.escapeHtml(hotel.city)}, ${this.escapeHtml(hotel.address)}
                        </div>
                        <div class="hotel-rating" title="${hotel.rating} stars">
                            ${ratingStars} <span>(${hotel.rating})</span>
                        </div>
                        <div class="hotel-price">
                            $${hotel.price_per_night} <small>/ night</small>
                        </div>
                        <div class="hotel-actions">
                            <button class="btn btn-primary btn-sm" onclick="app.showHotelDetails(${hotel.id})">
                                <i class="fas fa-info-circle"></i> Details
                            </button>
                            ${this.currentUser ? `
                                <button class="btn btn-secondary btn-sm" onclick="app.showBookingForm(${hotel.id})">
                                    <i class="fas fa-calendar-plus"></i> Book Now
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async showHotelDetails(hotelId) {
        try {
            const response = await fetch(`/api/hotels/${hotelId}`);
            if (!response.ok) throw new Error('Failed to fetch hotel details');

            const data = await response.json();
            const hotel = data.hotel;

            const modal = document.getElementById('hotelDetailsModal');
            const title = document.getElementById('hotelModalTitle');
            const body = document.getElementById('hotelModalBody');

            title.textContent = hotel.name;
            
            let html = `
                <div class="hotel-details">
                    <div class="detail-group">
                        <h4><i class="fas fa-info-circle"></i> Description</h4>
                        <p>${this.escapeHtml(hotel.description || 'No description available')}</p>
                    </div>
                    
                    <div class="detail-group">
                        <h4><i class="fas fa-map-marker-alt"></i> Location</h4>
                        <p><strong>City:</strong> ${this.escapeHtml(hotel.city)}</p>
                        <p><strong>Address:</strong> ${this.escapeHtml(hotel.address)}</p>
                    </div>
                    
                    <div class="detail-group">
                        <h4><i class="fas fa-star"></i> Rating & Price</h4>
                        <p><strong>Rating:</strong> ${hotel.rating} / 5</p>
                        <p><strong>Price per night:</strong> $${hotel.price_per_night}</p>
                    </div>`;

            if (hotel.amenities) {
                const amenities = JSON.parse(hotel.amenities);
                html += `
                    <div class="detail-group">
                        <h4><i class="fas fa-concierge-bell"></i> Amenities</h4>
                        <div class="amenities-list">
                            ${amenities.map(amenity => `
                                <span class="amenity-tag">
                                    <i class="fas fa-check"></i> ${this.escapeHtml(amenity)}
                                </span>
                            `).join('')}
                        </div>
                    </div>`;
            }

            if (hotel.rooms && hotel.rooms.length > 0) {
                html += `
                    <div class="detail-group">
                        <h4><i class="fas fa-bed"></i> Available Rooms</h4>
                        <div class="rooms-list">
                            ${hotel.rooms.map(room => `
                                <div class="room-item">
                                    <strong>Room ${room.room_number}</strong> - ${room.room_type}
                                    <br>
                                    <small>Max guests: ${room.max_guests} | Price: $${room.price_per_night}/night</small>
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
            }

            html += `
                <div class="modal-actions">
                    ${this.currentUser ? `
                        <button class="btn btn-primary" onclick="app.showBookingForm(${hotelId})">
                            <i class="fas fa-calendar-plus"></i> Book This Hotel
                        </button>
                    ` : `
                        <button class="btn btn-primary" onclick="app.showLoginModal()">
                            <i class="fas fa-sign-in-alt"></i> Login to Book
                        </button>
                    `}
                    <button class="btn btn-secondary" onclick="app.hideModal('hotelDetailsModal')">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            `;

            body.innerHTML = html;
            modal.classList.add('active');
        } catch (error) {
            console.error('Show hotel details error:', error);
            this.showNotification('Failed to load hotel details', 'error');
        }
    }

    async showBookingForm(hotelId) {
        if (!this.currentUser) {
            this.showNotification('Please login to make a booking', 'info');
            this.showLoginModal();
            return;
        }

        try {
            const response = await fetch(`/api/hotels/${hotelId}`);
            if (!response.ok) throw new Error('Failed to fetch hotel details');

            const data = await response.json();
            const hotel = data.hotel;

            const modal = document.getElementById('bookingModal');
            const title = document.getElementById('bookingModalTitle');
            const body = document.getElementById('bookingModalBody');

            title.textContent = `Book ${hotel.name}`;

            // Default dates (tomorrow for 2 nights)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const checkOut = new Date(tomorrow);
            checkOut.setDate(checkOut.getDate() + 2);

            const formatDate = (date) => date.toISOString().split('T')[0];

            let html = `
                <form id="bookingForm" onsubmit="event.preventDefault(); app.createBooking(${hotelId})">
                    <div class="form-group">
                        <label for="bookingCheckIn"><i class="fas fa-calendar-day"></i> Check-in Date</label>
                        <input type="date" id="bookingCheckIn" value="${formatDate(tomorrow)}" required min="${formatDate(new Date())}">
                    </div>
                    
                    <div class="form-group">
                        <label for="bookingCheckOut"><i class="fas fa-calendar-day"></i> Check-out Date</label>
                        <input type="date" id="bookingCheckOut" value="${formatDate(checkOut)}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="bookingGuests"><i class="fas fa-users"></i> Number of Guests</label>
                        <select id="bookingGuests" required>
                            <option value="1">1 Guest</option>
                            <option value="2" selected>2 Guests</option>
                            <option value="3">3 Guests</option>
                            <option value="4">4 Guests</option>
                            <option value="5">5+ Guests</option>
                        </select>
                    </div>`;

            if (hotel.rooms && hotel.rooms.length > 0) {
                html += `
                    <div class="form-group">
                        <label for="bookingRoom"><i class="fas fa-bed"></i> Select Room</label>
                        <select id="bookingRoom" required>
                            ${hotel.rooms.map(room => `
                                <option value="${room.id}">
                                    Room ${room.room_number} - ${room.room_type} ($${room.price_per_night}/night)
                                </option>
                            `).join('')}
                        </select>
                    </div>`;
            }

            html += `
                    <div class="form-group">
                        <label for="bookingRequests"><i class="fas fa-sticky-note"></i> Special Requests</label>
                        <textarea id="bookingRequests" rows="3" placeholder="Any special requests..."></textarea>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-check"></i> Confirm Booking
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="app.hideModal('bookingModal')">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </form>
            `;

            body.innerHTML = html;
            modal.classList.add('active');
        } catch (error) {
            console.error('Show booking form error:', error);
            this.showNotification('Failed to load booking form', 'error');
        }
    }

    async createBooking(hotelId) {
        try {
            const checkIn = document.getElementById('bookingCheckIn').value;
            const checkOut = document.getElementById('bookingCheckOut').value;
            const guests = document.getElementById('bookingGuests').value;
            const roomId = document.getElementById('bookingRoom').value;
            const requests = document.getElementById('bookingRequests').value;

            const bookingData = {
                user_id: this.currentUser.id,
                hotel_id: hotelId,
                room_id: roomId,
                check_in: checkIn,
                check_out: checkOut,
                guests: parseInt(guests),
                special_requests: requests || null
            };

            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(bookingData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Booking failed');
            }

            const result = await response.json();
            
            this.hideModal('bookingModal');
            this.showNotification('Booking created successfully!', 'success');
            
            // Switch to bookings view
            this.switchView('bookings');
        } catch (error) {
            console.error('Create booking error:', error);
            this.showNotification(error.message || 'Failed to create booking', 'error');
        }
    }

    async loadBookings() {
        try {
            const response = await fetch(`/api/bookings/user/${this.currentUser.id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch bookings');

            const data = await response.json();
            this.renderBookings(data.bookings);
        } catch (error) {
            console.error('Load bookings error:', error);
            this.showNotification('Failed to load bookings', 'error');
        }
    }

    renderBookings(bookings) {
        const container = document.getElementById('bookingsList');
        
        if (!bookings || bookings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar"></i>
                    <h3>No bookings found</h3>
                    <p>You haven't made any bookings yet</p>
                    <button class="btn btn-primary" onclick="app.switchView('hotels')">
                        <i class="fas fa-search"></i> Find Hotels
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        bookings.forEach(booking => {
            const checkIn = new Date(booking.check_in).toLocaleDateString();
            const checkOut = new Date(booking.check_out).toLocaleDateString();
            const created = new Date(booking.created_at).toLocaleDateString();
            
            html += `
                <div class="booking-card">
                    <div class="booking-header">
                        <span class="booking-number">${booking.booking_number || `BK${booking.id.toString().padStart(6, '0')}`}</span>
                        <span class="booking-status status-${booking.status}">
                            ${booking.status}
                        </span>
                    </div>
                    
                    <div class="booking-details">
                        <div class="booking-detail">
                            <span class="booking-label">Hotel</span>
                            <span class="booking-value">${booking.hotel_name || 'Loading...'}</span>
                        </div>
                        <div class="booking-detail">
                            <span class="booking-label">Check-in</span>
                            <span class="booking-value">${checkIn}</span>
                        </div>
                        <div class="booking-detail">
                            <span class="booking-label">Check-out</span>
                            <span class="booking-value">${checkOut}</span>
                        </div>
                        <div class="booking-detail">
                            <span class="booking-label">Guests</span>
                            <span class="booking-value">${booking.guests}</span>
                        </div>
                        <div class="booking-detail">
                            <span class="booking-label">Total Price</span>
                            <span class="booking-value">$${booking.total_price}</span>
                        </div>
                        <div class="booking-detail">
                            <span class="booking-label">Booked On</span>
                            <span class="booking-value">${created}</span>
                        </div>
                    </div>
                    
                    ${booking.status === 'pending' || booking.status === 'confirmed' ? `
                        <div class="booking-actions">
                            ${booking.status === 'pending' ? `
                                <button class="btn btn-primary btn-sm" onclick="app.confirmBooking(${booking.id})">
                                    <i class="fas fa-check"></i> Confirm
                                </button>
                            ` : ''}
                            <button class="btn btn-danger btn-sm" onclick="app.cancelBooking(${booking.id})">
                                <i class="fas fa-times"></i> Cancel
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async confirmBooking(bookingId) {
        try {
            const response = await fetch(`/api/bookings/${bookingId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: 'confirmed' })
            });

            if (!response.ok) throw new Error('Failed to confirm booking');

            this.showNotification('Booking confirmed successfully!', 'success');
            this.loadBookings();
        } catch (error) {
            console.error('Confirm booking error:', error);
            this.showNotification('Failed to confirm booking', 'error');
        }
    }

    async cancelBooking(bookingId) {
        if (!confirm('Are you sure you want to cancel this booking?')) {
            return;
        }

        try {
            const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to cancel booking');

            const result = await response.json();
            this.showNotification(`Booking cancelled. ${result.refund_note}`, 'success');
            this.loadBookings();
        } catch (error) {
            console.error('Cancel booking error:', error);
            this.showNotification('Failed to cancel booking', 'error');
        }
    }

    async loadProfile() {
        try {
            const response = await fetch(`/api/users/profile/${this.currentUser.id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch profile');

            const data = await response.json();
            this.renderProfile(data.user);
        } catch (error) {
            console.error('Load profile error:', error);
            this.showNotification('Failed to load profile', 'error');
        }
    }

    renderProfile(user) {
        const container = document.getElementById('profileContainer');
        
        const html = `
            <div class="profile-card">
                <div class="profile-header">
                    <div class="profile-avatar">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="profile-info">
                        <h3>${this.escapeHtml(user.name)}</h3>
                        <p class="profile-email">${this.escapeHtml(user.email)}</p>
                        ${user.phone ? `<p class="profile-phone"><i class="fas fa-phone"></i> ${this.escapeHtml(user.phone)}</p>` : ''}
                    </div>
                </div>
                
                <div class="profile-details">
                    <div class="detail-item">
                        <span class="detail-label">Member Since</span>
                        <span class="detail-value">
                            ${new Date(user.created_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                
                <div class="profile-actions">
                    <button class="btn btn-primary" onclick="app.showEditProfileModal()">
                        <i class="fas fa-edit"></i> Edit Profile
                    </button>
                    <button class="btn btn-danger" onclick="app.logout()">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    async login() {
        try {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Login failed');
            }

            const data = await response.json();
            
            // Store token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            this.currentUser = data.user;
            this.updateAuthUI();
            
            this.hideModal('loginModal');
            this.showNotification('Login successful!', 'success');
            
            // Clear form
            document.getElementById('loginForm').reset();
            
            // Switch to dashboard
            this.switchView('dashboard');
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification(error.message || 'Login failed', 'error');
        }
    }

    async register() {
        try {
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const phone = document.getElementById('registerPhone').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;

            if (password !== confirmPassword) {
                throw new Error('Passwords do not match');
            }

            const response = await fetch('/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, phone })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Registration failed');
            }

            const data = await response.json();
            
            // Auto login after registration
            localStorage.setItem('token', data.token);
            this.currentUser = { id: data.userId, name, email, phone };
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            this.updateAuthUI();
            
            this.hideModal('registerModal');
            this.showNotification('Registration successful!', 'success');
            
            // Clear form
            document.getElementById('registerForm').reset();
            
            // Switch to dashboard
            this.switchView('dashboard');
        } catch (error) {
            console.error('Register error:', error);
            this.showNotification(error.message || 'Registration failed', 'error');
        }
    }

    async validateToken(token) {
        try {
            const response = await fetch('/api/users/validate-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            const data = await response.json();
            
            if (data.valid) {
                // Get user from localStorage or fetch from API
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    this.currentUser = JSON.parse(storedUser);
                } else {
                    // Fetch user profile
                    const userResponse = await fetch(`/api/users/profile/${data.user.userId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        this.currentUser = userData.user;
                        localStorage.setItem('user', JSON.stringify(userData.user));
                    }
                }
                
                this.updateAuthUI();
            } else {
                // Token is invalid, clear stored data
                this.logout();
            }
        } catch (error) {
            console.error('Token validation error:', error);
            this.logout();
        }
    }

    updateAuthUI() {
        const authSection = document.getElementById('authSection');
        
        if (this.currentUser) {
            authSection.innerHTML = `
                <div class="user-menu">
                    <span class="user-greeting">
                        <i class="fas fa-user"></i> Hi, ${this.currentUser.name}
                    </span>
                    <button class="btn btn-sm btn-danger" onclick="app.logout()">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            `;
        } else {
            authSection.innerHTML = `
                <button class="btn btn-primary" id="loginBtn">Login</button>
                <button class="btn btn-secondary" id="registerBtn">Register</button>
            `;
            
            // Rebind event listeners for new buttons
            document.getElementById('loginBtn').addEventListener('click', () => this.showLoginModal());
            document.getElementById('registerBtn').addEventListener('click', () => this.showRegisterModal());
        }
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.currentUser = null;
        this.updateAuthUI();
        this.showNotification('Logged out successfully', 'info');
        this.switchView('dashboard');
    }

    showLoginModal() {
        document.getElementById('loginModal').classList.add('active');
    }

    showRegisterModal() {
        document.getElementById('registerModal').classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };

        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new HotelBookingApp();
});