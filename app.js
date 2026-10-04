    import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
    import { 
        getFirestore, collection, doc, getDoc, setDoc, addDoc, onSnapshot, 
        query, where, orderBy, serverTimestamp, runTransaction, updateDoc, 
        deleteDoc, getDocs, limit, startAfter 
    } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
    import { 
        getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
        signInWithEmailAndPassword, signOut, updateProfile, GoogleAuthProvider, 
        signInWithPopup, sendPasswordResetEmail 
    } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCpP1YS81i4tmg2qnwWK51QBJSVnMUCi-Q",
  authDomain: "chilmarie-shop.firebaseapp.com",
  projectId: "chilmarie-shop",
  storageBucket: "chilmarie-shop.firebasestorage.app",
  messagingSenderId: "124554201985",
  appId: "1:124554201985:web:9c3c869e5ef06ae37e7680",
  measurementId: "G-DHML1468ZP"
};
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

// --- SUPABASE CONFIG ---
const SUPABASE_URL = 'https://dxvtvtzspylltvmeelws.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JkQ00whheSlpwflgbiGGjA_rY5qHEZ0';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); // এখানেও supabaseClient দিন

// Global Variables er niche boshao
const IMGBB_API_KEY = "97d4b640c4eade4d075a2ac53a11d668"; // ⚠️ Ekhane tomar nijer ImgBB Key boshao
let returnImages = [];

// --- REVIEW SYSTEM CONFIG ---
const REVIEW_IMGBB_KEY = "97d4b640c4eade4d075a2ac53a11d668"; // Using the key you provided in context
let currentReviewImages = [];

// --- REVIEW IMAGE UPLOAD LOGIC ---
const uploadToImgBB = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${REVIEW_IMGBB_KEY}`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            return data.data.url;
        } else {
            throw new Error("Upload failed");
        }
    } catch (error) {
        console.error("ImgBB Error:", error);
        throw error;
    }
};

// Event Listener for Review File Input
document.getElementById('review-file-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (currentReviewImages.length + files.length > 5) {
        showToast("Max 5 images allowed.", "#ef4444");
        return;
    }

    const statusText = document.getElementById('upload-status-text');
    const uploadBtn = document.getElementById('review-upload-btn');
    const container = document.getElementById('review-img-container');
    
    statusText.classList.remove('hidden');
    
    for (const file of files) {
        try {
            const url = await uploadToImgBB(file);
            currentReviewImages.push(url);
            
            // Add to UI
            const div = document.createElement('div');
            div.className = "review-img-wrapper";
            div.innerHTML = `
                <img src="${url}" class="review-img-preview">
                <div class="review-img-remove" onclick="removeReviewImage('${url}', this)">&times;</div>
            `;
            container.insertBefore(div, uploadBtn);
        } catch (error) {
            showToast("Failed to upload an image.", "#ef4444");
        }
    }
    
    statusText.classList.add('hidden');
    if (currentReviewImages.length >= 5) uploadBtn.style.display = 'none';
});

window.removeReviewImage = (url, el) => {
    currentReviewImages = currentReviewImages.filter(img => img !== url);
    el.parentElement.remove();
    document.getElementById('review-upload-btn').style.display = 'flex';
};

// --- OPEN REVIEW MODAL ---
window.openReviewModal = (productId, productName, productImg) => {
    if (!auth.currentUser) return showLoginModal();
    
    // Reset Form
    document.getElementById('review-form').reset();
    document.getElementById('review-product-id').value = productId;
    currentReviewImages = [];
    
    // Reset UI
    const container = document.getElementById('review-img-container');
    container.innerHTML = `
        <label for="review-file-input" id="review-upload-btn" class="review-image-box hover:border-orange-500 transition-colors">
            <i class="fas fa-camera text-gray-400 text-lg"></i>
            <span class="text-[10px] text-gray-400 mt-1">Upload</span>
        </label>`;
    document.getElementById('review-upload-btn').style.display = 'flex';
    
    // Set Header Info
    document.getElementById('review-modal-name').textContent = productName;
    document.getElementById('review-modal-img').src = productImg;
    
    document.getElementById('write-review-modal').classList.add('active');
};

// --- ALL REVIEWS PAGE ---
window.openAllReviewsPage = (productId) => {
    window.showSection('all-reviews', productId);
};

const renderAllReviewsPage = async (productId) => {
    const listEl = document.getElementById('all-reviews-list');
    const emptyEl = document.getElementById('all-reviews-empty');
    const imgEl = document.getElementById('all-reviews-product-img');
    const nameEl = document.getElementById('all-reviews-product-name');
    const avgScoreEl = document.getElementById('all-reviews-avg-score');
    const starsEl = document.getElementById('all-reviews-stars');
    const countEl = document.getElementById('all-reviews-count');

    listEl.innerHTML = `<div class="flex justify-center py-10"><div class="loading-spinner"></div></div>`;
    emptyEl.classList.add('hidden');

    try {
        // Product info আনো
        const productSnap = await getDoc(doc(db, "products", productId));
        if (productSnap.exists()) {
            const p = productSnap.data();
            imgEl.src = p.imageUrl || '';
            nameEl.textContent = p.name || '';
            avgScoreEl.textContent = (p.avgRating || 0).toFixed(1) + '/5';
            starsEl.innerHTML = renderStars(p.avgRating || 0);
            countEl.textContent = `(${p.reviewCount || 0} reviews)`;
        }

        // Reviews আনো - client side এ Approved filter করো
        const q = query(
            collection(db, `products/${productId}/reviews`),
            orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);

        // Client side এ Approved filter
        const approvedDocs = snap.docs.filter(d => d.data().status === "Approved");

        if (approvedDocs.length === 0) {
            listEl.innerHTML = '';
            emptyEl.classList.remove('hidden');
            return;
        }

        listEl.innerHTML = approvedDocs.map(d => {
            const r = d.data();
            const date = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('en-GB') : '';
            const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
            const imagesHtml = (r.images && r.images.length > 0)
                ? `<div class="flex gap-2 mt-2 flex-wrap">${r.images.map(img => `<img src="${img}" class="w-16 h-16 object-cover rounded border" onclick="window.openImageViewer('${img}')">`).join('')}</div>`
                : '';
            const verifiedBadge = r.verifiedPurchase
                ? `<span class="text-[10px] text-green-600 font-bold ml-2"><i class="fas fa-check-circle mr-1"></i>Verified Purchase</span>`
                : '';
            return `
            <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                            ${(r.userName || 'A').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-gray-800">${r.userName || 'Anonymous'}${verifiedBadge}</p>
                            <p class="text-[10px] text-gray-400">${date}</p>
                        </div>
                    </div>
                    <span class="text-yellow-400 text-sm">${stars}</span>
                </div>
                <p class="text-sm text-gray-600 mt-1">${r.reviewText || ''}</p>
                ${r.adminReply ? `
                <div class="mt-3 ml-2">
                    <div class="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <div class="flex-shrink-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                            <i class="fas fa-store text-white text-xs"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center gap-1 mb-1">
                                <span class="text-xs font-bold text-primary-color">Seller Reply</span>
                                <i class="fas fa-check-circle text-xs text-primary-color"></i>
                            </div>
                            <p class="text-xs text-gray-700 leading-relaxed">${r.adminReply}</p>
                        </div>
                    </div>
                </div>` : ''}
                ${imagesHtml}

                <!-- Facebook-style comment section -->
                <div class="fb-comment-section" id="ar-fbcs-${d.id}" data-pid="${productId}" data-rid="${d.id}" data-page="1">
                    <div id="ar-fb-comments-list-${d.id}">
                        <div class="fb-time" style="color:#bbb;font-size:10px;">মন্তব্য লোড হচ্ছে...</div>
                    </div>
                    <div class="fb-input-row">
                        <div class="fb-avatar" style="width:28px;height:28px;font-size:10px;" id="ar-fb-self-av-${d.id}">
                            <i class="fas fa-user" style="font-size:10px;"></i>
                        </div>
                        <input class="fb-input" id="ar-fb-inp-${d.id}" placeholder="মন্তব্য করুন..." />
                        <button class="fb-send-btn" onclick="window.fbSubmitComment('${productId}','${d.id}',true)">
                            <i class="fas fa-paper-plane" style="font-size:11px;"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');

        // Load comments & update avatars for all-reviews page
        const currentUser = auth.currentUser;
        approvedDocs.forEach(d => {
            window.fbLoadComments(productId, d.id, true);
            const avEl = document.getElementById(`ar-fb-self-av-${d.id}`);
            if (avEl && currentUser) {
                if (currentUser.photoURL) {
                    avEl.innerHTML = `<img src="${currentUser.photoURL}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\"fas fa-user\\" style=\\"font-size:10px;\\"></i>'">`;
                } else {
                    avEl.textContent = (currentUser.displayName||'U').charAt(0).toUpperCase();
                }
            }
        });

    } catch (err) {
        console.error(err);
        listEl.innerHTML = `<p class="text-center text-red-400 py-10">Failed to load reviews.</p>`;
    }
};

// --- SUBMIT REVIEW (Final Fix: Transaction & Validation) ---
document.getElementById('review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-review-btn');
    
    // ভ্যালিডেশন: রেটিং সিলেক্ট করা হয়েছে কিনা
    const ratingInput = document.querySelector('input[name="rating"]:checked');
    if (!ratingInput) {
        showToast("Please select a star rating.", "#ef4444");
        return;
    }

    btn.disabled = true; 
    btn.textContent = "Submitting...";
    
    try {
        const productId = document.getElementById('review-product-id').value;
        const rating = parseInt(ratingInput.value);
        const text = document.getElementById('review-text').value;
        const isAnon = document.getElementById('review-anonymous').checked;
        
        const user = auth.currentUser;
        if (!user) throw new Error("You must be logged in.");
        
        const reviewData = {
            userId: user.uid,
            userName: isAnon ? "Anonymous" : (user.displayName || "Customer"),
            userAvatar: isAnon ? null : (user.photoURL || null),
            rating: rating,
            reviewText: text,
            images: currentReviewImages,
            productId: productId,
            status: "Approved",
            createdAt: serverTimestamp()
        };

        // 🔥 Transaction: একসাথে রিভিউ সেভ হবে এবং প্রোডাক্টের রেটিং আপডেট হবে
        const productRef = doc(db, "products", productId);
        const newReviewRef = doc(collection(db, `products/${productId}/reviews`));

        await runTransaction(db, async (transaction) => {
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists()) {
                throw "Product does not exist!";
            }

            const pData = productDoc.data();
            const currentAvg = pData.avgRating || 0;
            const currentCount = pData.reviewCount || 0;

            // নতুন গড় রেটিং ক্যালকুলেশন
            const newCount = currentCount + 1;
            const newAvg = ((currentAvg * currentCount) + rating) / newCount;

            // ১. রিভিউ সেভ করা
            transaction.set(newReviewRef, reviewData);

            // ২. প্রোডাক্টের রেটিং আপডেট করা
            transaction.update(productRef, {
                avgRating: newAvg,
                reviewCount: newCount
            });
        });

        showToast("Review submitted successfully!");
        document.getElementById('write-review-modal').classList.remove('active');
        
        // প্রোডাক্ট পেজ রিফ্রেশ না করে আপডেট দেখানোর জন্য
        if(currentProductState.productData && currentProductState.productData.id === productId) {
             window.viewProduct(productId, false);
        }

    } catch (error) {
        console.error(error);
        showToast("Error: " + error.message, "#ef4444");
    } finally {
        btn.disabled = false;
        btn.textContent = "Submit Review";
    }
});

    // --- GLOBAL STATE ---
    let productsUnsubscribe = null, ordersUnsubscribe = null, slidersUnsubscribe = null, categoriesUnsubscribe = null, offersUnsubscribe = null, settingsUnsubscribe = null, campaignsUnsubscribe = null;
    let cartUnsubscribe = null, wishlistUnsubscribe = null, profileUnsubscribe = null, reviewsUnsubscribe = null, notificationsUnsubscribe = null;

    let allProducts = [];
    let userCart = [];
    let userWishlist = [];
    let storeSettings = { deliveryCosts: { inside: 70, outside: 110 }, storeName: "Chilmari E-Shop" };
    let currentCategoryFilter = 'All';
    let currentSearchQuery = '';
    let lastVisibleProduct = null;
    let isFetchingProducts = false;
    const PRODUCTS_PER_PAGE = 10;
    let homeScrollPosition = 0;

    let currentProductState = {
        productData: null,
        selectedOptions: {},
        selectedCombination: null,
        productImageSwiper: null,
        popupAction: null, 
        popupQuantity: 1,
        popupSelectedOptions: {},
        popupSelectedCombination: null
    };

    // --- HELPER FUNCTIONS ---
    const debounce = (func, wait) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    };
    const showToast = (message, color = '#dc2626') => Toastify({ text: message, duration: 3000, gravity: "top", position: "center", style: { background: color, borderRadius: "50px", boxShadow: "0 2px 8px rgba(220, 38, 38, 0.2)" } }).showToast();
    const escapeHtml = (unsafe) => unsafe ? unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : '';

    const unsubscribePageUI = () => {
        if (productsUnsubscribe) productsUnsubscribe(); 
        if (ordersUnsubscribe) ordersUnsubscribe();
        if (slidersUnsubscribe) slidersUnsubscribe(); 
        if (categoriesUnsubscribe) categoriesUnsubscribe();
        if (offersUnsubscribe) offersUnsubscribe(); 
        if (reviewsUnsubscribe) reviewsUnsubscribe(); 
        if (campaignsUnsubscribe) campaignsUnsubscribe();
    }

    const unsubscribeUserData = () => {
        if (cartUnsubscribe) cartUnsubscribe();
        if (wishlistUnsubscribe) wishlistUnsubscribe(); 
        if (profileUnsubscribe) profileUnsubscribe();
        if (settingsUnsubscribe) settingsUnsubscribe();
        if (notificationsUnsubscribe) notificationsUnsubscribe();
    }

    // --- SEARCH EXECUTION ---
    const executeSearch = (query) => { 
        currentSearchQuery = query; 
        if (currentSearchQuery) { 
            let history = JSON.parse(localStorage.getItem('searchHistory') || '[]'); 
            history = history.filter(item => item.toLowerCase() !== currentSearchQuery.toLowerCase()); 
            history.unshift(currentSearchQuery); 
            if (history.length > 10) history.pop(); 
            localStorage.setItem('searchHistory', JSON.stringify(history)); 
        } 
        showSection('search', query); 
    };

// --- SEARCH FUNCTION (Supabase Version) ---
// এই অংশটি ৭৬৩ নম্বর লাইনের দিকে আছে, এটি রিপ্লেস করুন
const renderSearchPage = async (queryParam, sortType = 'relevance') => {
    const searchTerm = queryParam || currentSearchQuery;
    if (!searchTerm) return;

    const container = document.getElementById('search-results-container');
    const loading = document.getElementById('search-loading-indicator');
    const noResults = document.getElementById('no-search-results');
    
    container.innerHTML = '';
    noResults.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
        // --- আপনি এখানে সাধারণ কুয়েরি রেখে দিয়েছেন, এটি বদলে RPC করতে হবে ---
        let { data, error } = await supabaseClient
            .rpc('search_products_v2', { query_text: searchTerm });

        loading.classList.add('hidden');

        if (error) throw error;

        if (!data || data.length === 0) {
            noResults.classList.remove('hidden');
        } else {
            // সর্টিং লজিক (দাম অনুযায়ী সাজানো)
            if (sortType === 'price_asc') data.sort((a, b) => (a.price || 0) - (b.price || 0));
            if (sortType === 'price_desc') data.sort((a, b) => (b.price || 0) - (a.price || 0));
            
            container.innerHTML = data.map(p => renderProductCard(p.id, p)).join('');
        }
    } catch (e) {
        console.error("Search Error:", e);
        loading.classList.add('hidden');
    }
};

    // --- AUTOCOMPLETE SUGGESTIONS ---
document.getElementById('full-search-input').addEventListener('input', debounce(async (e) => { 
    const queryText = e.target.value.trim();
    const suggestionsBox = document.getElementById('search-suggestions-box'); 
    
    if (queryText.length < 2) { 
        suggestionsBox.innerHTML = ''; 
        return; 
    } 

    const { data } = await supabaseClient
        .from('products')
        .select('id, name, imageurl') // এখানে imageurl দিন
        .ilike('name', `%${queryText}%`)
        .limit(5);
    
    suggestionsBox.innerHTML = data && data.length > 0 
        ? data.map(r => `
            <div class="p-3 border-b cursor-pointer hover:bg-gray-100 search-suggestion-item" data-id="${r.id}">
                <div class="flex items-center gap-2">
                    <img src="${r.imageurl || r.imageUrl}" class="w-8 h-8 object-cover rounded">
                    <p class="text-sm font-medium">${r.name}</p>
                </div>
            </div>`).join('') 
        : '';
}, 300));

    // --- EXISTING APP LOGIC (UNCHANGED) ---
    // (বাকি সব লজিক আগের মতোই রাখা হয়েছে যাতে আপনার অ্যাপ ব্রেক না করে)

    const listenToStoreSettings = () => {
        if (settingsUnsubscribe) settingsUnsubscribe();
        const docRef = doc(db, "settings", "siteConfig");
        settingsUnsubscribe = onSnapshot(docRef, (docSnap) => {
             if (docSnap.exists()) {
                const data = docSnap.data();
                if(data.storeSettings) {
                    storeSettings = {...storeSettings, ...data.storeSettings};
                    document.getElementById('store-logo').src = storeSettings.storeLogoUrl || 'https://via.placeholder.com/40';
                   document.getElementById('store-logo-home').src = storeSettings.storeLogoUrl || 'https://via.placeholder.com/40';
                    document.getElementById('header-title').textContent = storeSettings.storeName || 'Chilmari E-Shop';
                    document.querySelector('.nav-item[data-section="home"]').dataset.title = storeSettings.storeName || 'Chilmari E-Shop';
                    if(document.getElementById('product-sold-by')) document.getElementById('product-sold-by').textContent = storeSettings.storeName || 'Official Store';
                }
                if(data.deliveryCosts) storeSettings.deliveryCosts = data.deliveryCosts;
                if(data.supportLinks) {
                    storeSettings.supportLinks = data.supportLinks;
                    if(document.getElementById('support-section').classList.contains('active-section')) renderSupportLinks(data.supportLinks);
                }
                if(data.aboutUs) {
                    storeSettings.aboutUs = data.aboutUs;
                    if(document.getElementById('about-us-section').classList.contains('active-section')) renderAboutUs(data.aboutUs);
                }
            }
        });
    };

    const listenToCart = (uid) => {
        if (cartUnsubscribe) cartUnsubscribe();
        const cartItemsRef = collection(db, `users/${uid}/cartItems`);
        cartUnsubscribe = onSnapshot(cartItemsRef, (snapshot) => {
            userCart = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateCartCount();
            if (document.getElementById('cart-section').classList.contains('active-section')) renderCart();
            if (document.getElementById('checkout-section').classList.contains('active-section')) updateCheckoutSummary();
        }, (error) => console.error("Error listening to cart:", error) );
    };
    
    const listenToWishlist = (uid) => {
        if (wishlistUnsubscribe) wishlistUnsubscribe();
        wishlistUnsubscribe = onSnapshot(collection(db, `users/${uid}/wishlist`), (snapshot) => {
            userWishlist = snapshot.docs.map(doc => doc.id);
            if (document.getElementById('wishlist-section').classList.contains('active-section')) renderWishlist();
            document.querySelectorAll('.wishlist-btn').forEach(button => {
                const productId = button.dataset.productid;
                const icon = button.querySelector('.wishlist-btn-icon');
                if (userWishlist.includes(productId)) {
                    icon.classList.remove('far'); icon.classList.add('fas');
                    button.classList.add('text-red-500'); button.classList.remove('text-gray-300', 'text-gray-500');
                } else {
                    icon.classList.add('far'); icon.classList.remove('fas');
                    button.classList.remove('text-red-500');
                    if (document.getElementById('product-view-section').contains(button)) button.classList.add('text-gray-500');
                    else button.classList.add('text-gray-300');
                }
            });
        }, (error) => console.error("Error listening to wishlist:", error) );
    };
    
    const listenToUserProfile = (uid) => {
         if (profileUnsubscribe) profileUnsubscribe();
         profileUnsubscribe = onSnapshot(doc(db, "users", uid), (docSnap) => {
             if (docSnap.exists()) {
                 const userProfile = docSnap.data();
                 document.getElementById('user-display-name').textContent = userProfile.name || auth.currentUser.displayName || 'User';
                 document.getElementById('profile-name').value = userProfile.name || '';
                 document.getElementById('profile-email').value = userProfile.email || '';
                 document.getElementById('profile-phone').value = userProfile.phone || '';
                 renderAddresses(userProfile.addresses || []);
             }
         }, (error) => console.error("Error listening to profile:", error) );
    }

    const initializeUserDependentState = (user) => {
        unsubscribePageUI();
        unsubscribeUserData();
        
        listenToStoreSettings();
        if (user) {
            listenToCart(user.uid);
            listenToWishlist(user.uid);
            listenToUserProfile(user.uid);
            document.getElementById('user-display-name').textContent = user.displayName || 'User';
            document.getElementById('login-button').classList.add('hidden');
            document.getElementById('logout-button').classList.remove('hidden');
            // Google profile photo দেখানো
            const avatarImg = document.getElementById('account-avatar-img');
            const avatarIcon = document.getElementById('account-avatar-icon');
            if (user.photoURL && avatarImg) {
                avatarImg.src = user.photoURL;
                avatarImg.setAttribute('referrerpolicy', 'no-referrer');
                avatarImg.onerror = () => { avatarImg.classList.add('hidden'); if(avatarIcon) avatarIcon.classList.remove('hidden'); };
                avatarImg.classList.remove('hidden');
                if(avatarIcon) avatarIcon.classList.add('hidden');
            } else if (avatarImg) {
                avatarImg.classList.add('hidden');
                if(avatarIcon) avatarIcon.classList.remove('hidden');
            }
        } else {
            userCart = [];
            userWishlist = [];
            updateCartCount();
            if (document.getElementById('cart-section').classList.contains('active-section')) renderCart();
            if (document.getElementById('wishlist-section').classList.contains('active-section')) renderWishlist();
            document.getElementById('user-display-name').textContent = "Guest User";
            document.getElementById('login-button').classList.remove('hidden');
            document.getElementById('logout-button').classList.add('hidden');
        }
    }
    
    document.getElementById('login-form').addEventListener('submit', async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); showToast('Login successful!'); hideLoginModal(); } catch (error) { showToast(`Login failed: ${error.message}`, '#ef4444'); } });
    document.getElementById('register-form').addEventListener('submit', async (e) => { e.preventDefault(); const name = document.getElementById('register-name').value, email = document.getElementById('register-email').value, password = document.getElementById('register-password').value; if (password.length < 6) { showToast('Password must be at least 6 characters long.', '#ef4444'); return; } try { const userCredential = await createUserWithEmailAndPassword(auth, email, password); await updateProfile(userCredential.user, { displayName: name }); await setDoc(doc(db, "users", userCredential.user.uid), { name, email, role: 'customer', createdAt: serverTimestamp() }); showToast('Registration successful!'); hideRegisterModal(); } catch (error) { showToast(`Registration failed: ${error.message}`, '#ef4444');} });
    document.getElementById('logout-button').addEventListener('click', () => { if(confirm('Are you sure you want to logout?')) { signOut(auth).then(() => showSection('home')); } });
    document.getElementById('google-login-btn').addEventListener('click', async () => { const provider = new GoogleAuthProvider(); try { const result = await signInWithPopup(auth, provider); const user = result.user; const userDocRef = doc(db, 'users', user.uid); const userDocSnap = await getDoc(userDocRef); if (!userDocSnap.exists()) { await setDoc(userDocRef, { name: user.displayName, email: user.email, role: 'customer', createdAt: serverTimestamp() }); } showToast('Login with Google successful!'); hideLoginModal(); } catch (error) { showToast(`Google login failed: ${error.message}`, '#ef4444'); } });
    document.getElementById('forgot-password-link').addEventListener('click', async (e) => { e.preventDefault(); const email = document.getElementById('login-email').value || prompt("Please enter your email address to reset your password:"); if (email) { try { await sendPasswordResetEmail(auth, email); showToast(`A password reset link has been sent to ${email}`); } catch (error) { showToast(`Error: ${error.message}`, '#ef4444'); } } else if (!document.getElementById('login-email').value) { showToast(`Please enter an email address first.`, '#ef4444'); } });

    const loginModal = document.getElementById('login-modal'), registerModal = document.getElementById('register-modal'), addressModal = document.getElementById('address-modal'), selectAddressModal = document.getElementById('select-address-modal'), orderDetailsModal = document.getElementById('order-details-modal');
    const showLoginModal = () => loginModal.classList.add('active'), hideLoginModal = () => loginModal.classList.remove('active'), showRegisterModal = () => registerModal.classList.add('active'), hideRegisterModal = () => registerModal.classList.remove('active'), showAddressModal = () => addressModal.classList.add('active'), hideAddressModal = () => addressModal.classList.remove('active'), showSelectAddressModal = () => selectAddressModal.classList.add('active'), hideSelectAddressModal = () => selectAddressModal.classList.remove('active');
    window.hideOrderDetailsModal = () => orderDetailsModal.classList.remove('active');
    const showOrderDetailsModal = () => orderDetailsModal.classList.add('active');

    document.getElementById('login-button').addEventListener('click', showLoginModal);
    document.getElementById('close-modal-btn').addEventListener('click', hideLoginModal);
    document.getElementById('close-register-modal-btn').addEventListener('click', hideRegisterModal);
    document.getElementById('show-register').addEventListener('click', (e) => { e.preventDefault(); hideLoginModal(); showRegisterModal(); });
    document.getElementById('show-login').addEventListener('click', (e) => { e.preventDefault(); hideRegisterModal(); showLoginModal(); });
    document.getElementById('close-address-modal-btn').addEventListener('click', hideAddressModal);
    document.getElementById('close-select-address-modal-btn').addEventListener('click', hideSelectAddressModal);
    document.getElementById('add-address-btn').addEventListener('click', () => { document.getElementById('address-form').reset(); document.getElementById('address-id').value = ''; document.getElementById('address-modal-title').textContent = 'Add New Address'; showAddressModal(); });

    const setupPasswordToggle = (inputId, toggleId) => {
        const passwordInput = document.getElementById(inputId);
        const toggleIcon = document.getElementById(toggleId);

        if (passwordInput && toggleIcon) {
            toggleIcon.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                toggleIcon.classList.toggle('fa-eye');
                toggleIcon.classList.toggle('fa-eye-slash');
            });
        }
    };
    setupPasswordToggle('login-password', 'toggle-login-password');
    setupPasswordToggle('register-password', 'toggle-register-password');

    const mainHeader = document.getElementById('main-header'), homeHeader = document.getElementById('home-header');

    const clearCheckoutSession = () => {
        sessionStorage.removeItem('buyNowItem');
        sessionStorage.removeItem('checkoutForm');
        sessionStorage.removeItem('appliedCoupon');
    };

    const navigate = (sectionId, param, addToHistory) => {
    const state = { sectionId, param };
    if (addToHistory) {
        // ক্লিন ইউআরএল তৈরি: /home অথবা /product-view/12345
        const url = (sectionId === 'home') ? '/' : `/${sectionId}` + (param ? `/${param}` : '');
        history.pushState(state, '', url);
    }
    renderPage(state);
}

    window.showSection = (sectionId, param = null, addToHistory = true) => {
        const currentSection = document.querySelector('.section.active-section')?.id.replace('-section', '');
        if (currentSection === 'checkout' && sectionId !== 'checkout') {
            clearCheckoutSession();
        }
        navigate(sectionId, param, addToHistory);
    };
    
    const renderPage = (state) => {
        const { sectionId, param } = state;
        
        const currentSection = document.querySelector('.section.active-section');
        if (currentSection && currentSection.id === 'home-section') {
            homeScrollPosition = window.scrollY;
        }
        
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active-section'));
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active-nav'));
        
        const section = document.getElementById(`${sectionId}-section`);
        if (!section) return renderPage({ sectionId: 'home', param: null }); 
        section.classList.add('active-section');
        
        const activeNavItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
        if (activeNavItem) activeNavItem.classList.add('active-nav');

        const isHomePage = sectionId === 'home', isFullSearchPage = sectionId === 'full-search-page';
        mainHeader.style.display = (isHomePage || isFullSearchPage) ? 'none' : 'flex';
        homeHeader.style.display = isHomePage ? 'flex' : 'none';
        document.getElementById('header-back-button').style.visibility = history.length > 1 ? 'visible' : 'hidden';
        
        let title = activeNavItem ? activeNavItem.dataset.title : storeSettings.storeName;
        const titleMap = { 'product-view': 'Product Details', 'search': 'Search Results', 'notifications': 'Notifications', 'support': 'Support', 'checkout': 'Checkout', 'about-us': 'About Us', 'campaign-page': 'Campaign', 'all-reviews': 'All Reviews', 'flash-sale': '⚡ Flash Sale' };
        if (titleMap[sectionId]) title = titleMap[sectionId];
        document.getElementById('header-title').textContent = title;

        unsubscribePageUI(); 

        // Canonical reset: প্রোডাক্ট পেজ ছাড়া হোম URL সেট করো
        if (sectionId !== 'product-view') {
            const canEl = document.getElementById('canonical-link') || document.querySelector('link[rel="canonical"]');
            if (canEl) canEl.setAttribute('href', 'https://chilmarieshop.top/');
        }
        
        switch (sectionId) {
            case 'home': 
                window.scrollTo(0, homeScrollPosition);
                listenToSliders(); 
                listenToCategories(); 
                listenToOffers(); 
                listenToCampaigns(); 
                startCountdown(); 
                if (currentCategoryFilter !== 'All' || allProducts.length === 0) { 
                    currentCategoryFilter = 'All'; 
                    fetchProducts(true); 
                } 
                break;
            case 'cart': renderCart(); window.scrollTo(0, 0); break;
            case 'checkout': renderCheckout(); window.scrollTo(0, 0); break;
            case 'orders': listenToOrders(param || 'all'); window.scrollTo(0, 0); break;
            case 'wishlist': renderWishlist(); window.scrollTo(0, 0); break;
            case 'search': 
                window.scrollTo(0, 0);
                renderSearchPage(param); 
                break;
            case 'full-search-page': 
                // Just show the page, index builds in background
                break;
            case 'product-view': if(param) window.viewProduct(param, false); break;
            case 'campaign-page': if(param) renderCampaignPage(param); window.scrollTo(0, 0); break;
            case 'notifications': listenToNotifications(); window.scrollTo(0, 0); break;
            case 'support': renderSupportLinks(storeSettings.supportLinks); window.scrollTo(0, 0); break;
            case 'about-us': renderAboutUs(storeSettings.aboutUs); window.scrollTo(0, 0); break;
            case 'all-reviews': if(param) renderAllReviewsPage(param); window.scrollTo(0, 0); break;
            case 'flash-sale': renderFlashSalePage(); window.scrollTo(0, 0); break;
        }
    };

    window.onpopstate = (event) => { if (event.state) renderPage(event.state); };
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => showSection(item.dataset.section, null, true) ));
    document.getElementById('header-back-button').addEventListener('click', () => history.back() );
    
    let homeSwiper;
    const listenToSliders = () => {
        if (homeSwiper) {
            homeSwiper.destroy(true, true);
            homeSwiper = null;
        }
        const sliderWrapper = document.querySelector('#home-slider-container .swiper-wrapper');
        const sliderContainer = document.getElementById('home-slider-container');
        if (!sliderWrapper || !sliderContainer) return;

        sliderContainer.style.display = 'block';
        sliderWrapper.innerHTML = `<div class="swiper-slide"><div class="bg-gray-200 h-full w-full animate-pulse"></div></div>`;

        slidersUnsubscribe = onSnapshot(query(collection(db, "sliders"), orderBy("createdAt", "desc")), (snapshot) => {
            if (snapshot.empty) {
                sliderContainer.style.display = 'none';
                return;
            }
            
            sliderWrapper.innerHTML = snapshot.docs.map(doc => {
                const data = doc.data();
                const hasLink = data.campaignPageId && data.campaignPageId !== "";
                const clickAction = hasLink ? `onclick="window.showSection('campaign-page', '${data.campaignPageId}')"` : '';
                const cursorClass = hasLink ? 'cursor-pointer' : '';
                
                return `<div class="swiper-slide" ${clickAction}>
                            <img src="${escapeHtml(data.imageUrl)}" class="w-full h-full object-cover ${cursorClass}" loading="lazy">
                        </div>`;
            }).join('');

            homeSwiper = new Swiper('#home-slider-container', {
                loop: true,
                autoplay: { delay: 4000, disableOnInteraction: false },
                pagination: { el: '.swiper-pagination', clickable: true },
                effect: 'fade',
                fadeEffect: { crossFade: true },
            });
        }, (error) => console.error("Error listening to sliders:", error));
    };
    const listenToOffers = () => { const offerBanner = document.getElementById('offer-banner'); const q = query(collection(db, "offers"), orderBy("createdAt", "desc"), limit(1)); offersUnsubscribe = onSnapshot(q, (snapshot) => { if (snapshot.empty) { offerBanner.classList.add('hidden'); return; } const latestOffer = snapshot.docs[0].data(); offerBanner.innerHTML = `<i class="fas fa-gift mr-2"></i> ${escapeHtml(latestOffer.title)}: ${escapeHtml(latestOffer.message)}`; offerBanner.classList.remove('hidden'); }, (error) => console.error("Error listening to offers:", error)); };
    const listenToCategories = () => { const categoriesContainer = document.getElementById('categories-container'); categoriesUnsubscribe = onSnapshot(query(collection(db, "categories"), orderBy("name")), (snapshot) => { categoriesContainer.innerHTML = renderCategoryCard('All', 'https://i.ibb.co/1Y7ScG4n/download.jpg') + snapshot.docs.map(doc => renderCategoryCard(doc.data().name, doc.data().imageUrl)).join(''); categoriesContainer.querySelectorAll('.category-card-horizontal').forEach(card => card.addEventListener('click', () => { currentCategoryFilter = card.dataset.categoryName; fetchProducts(true); })); }, (error) => console.error("Error listening to categories:", error)); };
    const renderCategoryCard = (name, imageUrl) => `<div class="category-card-horizontal p-1 cursor-pointer" data-category-name="${escapeHtml(name)}"><div class="w-16 h-16 mx-auto flex items-center justify-center bg-gray-100 rounded-full overflow-hidden"><img src="${escapeHtml(imageUrl)}" class="w-full h-full object-cover" loading="lazy"></div><span class="text-xs mt-1 block text-gray-700 truncate">${escapeHtml(name)}</span></div>`;
    const renderSkeletonLoader = (count) => { let skeletons = ''; for (let i = 0; i < count; i++) { skeletons += `<div class="skeleton-card shimmer"><div class="skeleton-img"></div><div class="p-2"><div class="skeleton-text"></div><div class="skeleton-text w-3/4"></div><div class="skeleton-price"></div></div></div>`; } return skeletons; };

    const fetchProducts = async (isNewQuery = false) => {
        if (isFetchingProducts) return; isFetchingProducts = true;
        const productsContainer = document.getElementById('products-container');
        const loadingIndicator = document.getElementById('loading-indicator');
        const sentinel = document.getElementById('infinite-scroll-sentinel');
        const allLoadedMsg = document.getElementById('all-products-loaded');
        if (isNewQuery) { allProducts = []; productsContainer.innerHTML = ''; lastVisibleProduct = null; document.getElementById('products-list-title').textContent = currentCategoryFilter === 'All' ? 'Recommended for You' : `Products in ${currentCategoryFilter}`; allLoadedMsg.classList.add('hidden'); }
        loadingIndicator.innerHTML = renderSkeletonLoader(4); sentinel.classList.add('hidden');
        try {
            let q; const productsRef = collection(db, "products"); const constraints = [];
            if (currentCategoryFilter !== 'All') constraints.push(where("category", "==", currentCategoryFilter));
            if (lastVisibleProduct && !isNewQuery) constraints.push(startAfter(lastVisibleProduct));
            constraints.push(limit(PRODUCTS_PER_PAGE)); q = query(productsRef, ...constraints);
            const documentSnapshots = await getDocs(q);
            loadingIndicator.innerHTML = ''; document.getElementById('no-products').classList.toggle('hidden', allProducts.length > 0 || !documentSnapshots.empty);
            const newProducts = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allProducts.push(...newProducts); productsContainer.innerHTML += newProducts.map(p => renderProductCard(p.id, p)).join('');
            lastVisibleProduct = documentSnapshots.docs[documentSnapshots.docs.length - 1];
            if (documentSnapshots.docs.length < PRODUCTS_PER_PAGE) {
                sentinel.classList.add('hidden');
                allLoadedMsg.classList.remove('hidden');
            } else {
                sentinel.classList.remove('hidden');
            }
        } catch (error) { console.error("Error fetching products:", error); loadingIndicator.innerHTML = '<p class="text-red-500 text-center col-span-full">Could not load products.</p>'; } 
        finally { isFetchingProducts = false; }
    };

    // Infinite Scroll — IntersectionObserver দিয়ে
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isFetchingProducts) {
                fetchProducts(false);
            }
        });
    }, { rootMargin: '200px' });
    scrollObserver.observe(document.getElementById('infinite-scroll-sentinel'));
    
    const listenToCampaigns = () => {
        const container = document.getElementById('campaigns-container');
        if (!container) return;
        if (campaignsUnsubscribe) campaignsUnsubscribe();
        const q = query(collection(db, "campaignPages"), where("status", "==", "published"), orderBy("createdAt", "desc"));
        campaignsUnsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                container.innerHTML = '';
                container.style.display = 'none';
                return;
            }
            container.style.display = 'block';
            container.innerHTML = `
                <div class="p-3 bg-white">
                    <h2 class="text-md font-bold text-gray-800">Special Campaigns</h2>
                </div>
                <div class="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${snapshot.docs.map(doc => renderCampaignBanner(doc.id, doc.data())).join('')}
                </div>
            `;
        }, (error) => console.error("Error listening to campaigns:", error));
    };

    const renderCampaignBanner = (id, data) => {
        return `
        <div class="rounded-lg overflow-hidden shadow-sm cursor-pointer" onclick="showSection('campaign-page', '${id}')">
            <img src="${escapeHtml(data.coverImage)}" alt="${escapeHtml(data.title)}" class="w-full h-32 object-cover">
            <div class="p-3 bg-white">
                <h3 class="font-bold text-gray-800 truncate">${escapeHtml(data.title)}</h3>
                <p class="text-xs text-gray-500 line-clamp-2 mt-1">${escapeHtml(data.description || '')}</p>
            </div>
        </div>
        `;
    };

    const renderCampaignPage = async (campaignId) => {
        const headerDiv = document.getElementById('campaign-page-header');
        const productsContainer = document.getElementById('campaign-products-container');
        const loadingIndicator = document.getElementById('campaign-loading-indicator');
        const noProductsView = document.getElementById('no-campaign-products');

        headerDiv.innerHTML = '';
        productsContainer.innerHTML = '';
        noProductsView.classList.add('hidden');
        loadingIndicator.innerHTML = renderSkeletonLoader(4);
        loadingIndicator.classList.remove('hidden');

        try {
            const campaignDoc = await getDoc(doc(db, "campaignPages", campaignId));
            if (!campaignDoc.exists()) {
                headerDiv.innerHTML = '<p class="p-4 text-center text-red-500">Campaign not found.</p>';
                loadingIndicator.classList.add('hidden');
                return;
            }
            const campaign = campaignDoc.data();
            
            document.getElementById('header-title').textContent = campaign.title;

            headerDiv.innerHTML = `
                <div class="bg-white">
                    <img src="${escapeHtml(campaign.coverImage)}" class="w-full h-48 object-cover">
                    <div class="p-4">
                        <h2 class="text-xl font-bold">${escapeHtml(campaign.title)}</h2>
                        <p class="text-sm text-gray-600 mt-2">${(campaign.description || '').replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            `;

            let allowedProductIds = [];
            if (campaign.productGroups && Array.isArray(campaign.productGroups)) {
                campaign.productGroups.forEach(group => {
                    if (group.productIds && Array.isArray(group.productIds)) {
                        allowedProductIds = [...allowedProductIds, ...group.productIds];
                    }
                });
            }
            // ✅ Direct products (Flash Sale style) also included
            if (campaign.directProductIds && Array.isArray(campaign.directProductIds)) {
                allowedProductIds = [...allowedProductIds, ...campaign.directProductIds];
            }
            
            allowedProductIds = [...new Set(allowedProductIds)];

            if (allowedProductIds.length === 0) {
                loadingIndicator.classList.add('hidden');
                noProductsView.classList.remove('hidden');
                return;
            }

            const productPromises = allowedProductIds.slice(0, 50).map(id => getDoc(doc(db, "products", id)));
            const productSnaps = await Promise.all(productPromises);
            
            const campaignProducts = productSnaps
                .filter(snap => snap.exists())
                .map(snap => ({ id: snap.id, ...snap.data() }));

            loadingIndicator.classList.add('hidden');
            if (campaignProducts.length > 0) {
                productsContainer.innerHTML = campaignProducts.map(p => renderProductCard(p.id, p)).join('');
            } else {
                noProductsView.classList.remove('hidden');
            }

        } catch (error) {
            console.error("Error rendering campaign page:", error);
            headerDiv.innerHTML = '<p class="p-4 text-center text-red-500">Could not load campaign.</p>';
            loadingIndicator.classList.add('hidden');
        }
    };

    document.getElementById('home-search-trigger').addEventListener('click', () => showSection('full-search-page'));
    document.getElementById('back-from-full-search').addEventListener('click', () => history.back());
    document.getElementById('full-search-form').addEventListener('submit', (e) => { 
        e.preventDefault(); 
        const query = document.getElementById('full-search-input').value.trim(); 
        if (query) executeSearch(query); 
    });
    document.getElementById('search-suggestions-box').addEventListener('click', (e) => { 
        const item = e.target.closest('.search-suggestion-item'); 
        if (item) window.viewProduct(item.dataset.id); 
    });

// index.html ফাইলের renderProductCard ফাংশনটি এভাবে আপডেট করুন
const renderProductCard = (id, data) => { 
    const isInWishlist = userWishlist.includes(id); 
    
    // --- ইমেজ এবং প্রাইজের জন্য ফিক্স ---
    // সুপাবেসে কলামের নাম 'price' এবং 'imageurl' (সব ছোট হাত)
    const basePrice = data.price || data.basePrice || 0;
    const currentImage = data.imageurl || data.imageUrl || 'https://via.placeholder.com/150';
    
    const hasDiscount = data.oldPrice && data.oldPrice > basePrice; 
    let priceDisplay = `৳${basePrice}`; 
    
    // স্টার রেন্ডারিং লজিক
    const ratingNum = data.avgRating || 0;
    const reviewCount = data.reviewCount || 0;
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.round(ratingNum)) {
            starsHtml += '<i class="fas fa-star text-yellow-400 text-[10px]"></i>';
        } else {
            starsHtml += '<i class="fas fa-star text-gray-300 text-[10px]"></i>';
        }
    }

    // --- Badge HTML ---
    let badgeHtml = '';
    if (data.badge) {
        const badgeColors = {
            'SALE': 'bg-red-500',
            'OFFER': 'bg-orange-500',
            'HOT DEAL': 'bg-yellow-500',
            'NEW': 'bg-green-500',
            'POPULAR': 'bg-blue-500',
        };
        const badgeColor = badgeColors[data.badge] || 'bg-red-500';
        badgeHtml = `<span class="product-badge absolute top-2 left-2 ${badgeColor} text-white text-[10px] font-bold px-1.5 py-0.5 rounded">${escapeHtml(data.badge)}</span>`;
    }

    return `
    <div class="product-card" onclick="window.viewProduct('${id}')">
        <div class="h-40 bg-gray-100 relative">
            <img src="${escapeHtml(currentImage)}" alt="${escapeHtml(data.name)}" class="w-full h-full object-cover" loading="lazy">
            ${badgeHtml}
            <button class="absolute top-2 right-2 text-2xl wishlist-btn ${isInWishlist ? 'text-red-500' : 'text-gray-300'}" data-productid="${id}" onclick="event.stopPropagation(); window.toggleWishlist('${id}')">
                <i class="wishlist-btn-icon ${isInWishlist ? 'fas' : 'far'} fa-heart"></i>
            </button>
        </div>
        <div class="p-2 flex flex-col flex-grow">
            <h3 class="font-normal text-sm text-gray-800 leading-tight line-clamp-2 flex-grow">${escapeHtml(data.name)}</h3>
            <div class="mt-2">
                <p class="text-primary-color font-semibold text-base">${priceDisplay}</p>
                ${hasDiscount ? `<div class="flex items-center gap-2"><span class="text-xs text-gray-400 line-through">৳${data.oldPrice}</span> <span class="text-xs text-red-500 font-medium">-${Math.round(((data.oldPrice - basePrice) / data.oldPrice) * 100)}%</span></div>` : ''}
            </div>
            <div class="flex items-center mt-1 gap-1">
                <div class="flex">${starsHtml}</div>
                <span class="text-xs text-gray-500">(${reviewCount})</span>
            </div>
        </div>
    </div>`; 
};
    
    let zoomSwiper;

    const initializeZoomSwiper = (imageUrls, initialSide) => {
        const zoomModal = document.getElementById('image-zoom-modal');
        const zoomWrapper = document.querySelector('#zoom-swiper .swiper-wrapper');
        const zoomCounter = document.getElementById('zoom-swiper-counter');

        zoomWrapper.innerHTML = imageUrls.map(url => `
            <div class="swiper-slide">
                <div class="swiper-zoom-container">
                    <img src="${escapeHtml(url)}" loading="lazy">
                </div>
            </div>
        `).join('');

        if (zoomSwiper) {
            zoomSwiper.destroy(true, true);
            zoomSwiper = null;
        }

        zoomModal.classList.add('active');

        const updateZoomCounter = (swiperInstance) => {
            if (zoomCounter) {
                zoomCounter.textContent = `${swiperInstance.realIndex + 1} / ${swiperInstance.slides.length}`;
            }
        };

        zoomSwiper = new Swiper('#zoom-swiper', {
            initialSlide: initialSide,
            zoom: true,
            observer: true,       
            observeParents: true, 
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev'
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            on: {
                init: function () {
                    updateZoomCounter(this);
                },
                slideChange: function () {
                    updateZoomCounter(this);
                }
            }
        });
    };
  
    const updateVariationView = (context) => {
        const { productData } = currentProductState;
        if (!productData) return;
        const isPopup = context === 'popup';

        const selectedOptions = isPopup ? currentProductState.popupSelectedOptions : currentProductState.selectedOptions;
        const container = isPopup ? document.getElementById('variation-popup-content') : document.getElementById('product-view-content');
        const priceEl = isPopup ? document.getElementById('popup-product-price') : document.getElementById('product-price-display');
        const oldPriceEl = isPopup ? null : document.getElementById('product-old-price-display'); 
        const stockEl = isPopup ? document.getElementById('popup-product-stock') : document.getElementById('product-stock-display');
        const imageEl = isPopup ? document.getElementById('popup-product-image') : null; 
        const selectedVariationEl = isPopup ? document.getElementById('popup-selected-variation') : null;
        const confirmBtn = isPopup ? document.getElementById('popup-confirm-btn') : null;

        if (!container) return;
        
        if(productData.hasVariations){
            const variationGroups = container.querySelectorAll('.variation-group');
            variationGroups.forEach(group => {
                const currentType = group.dataset.variationType;
                const options = group.querySelectorAll('.variation-option');
                options.forEach(optionBtn => {
                    const optionValue = optionBtn.dataset.value;
                    let tempSelection = { ...selectedOptions, [currentType]: optionValue };
                    const isAvailable = productData.variationCombinations.some(c => 
                        Object.keys(tempSelection).every(type => c.combination[type] === tempSelection[type])
                    );
                    optionBtn.disabled = !isAvailable;
                });
            });
        }

        const allOptionsSelected = !productData.hasVariations || productData.variations.every(v => selectedOptions[v.type]);
        let finalCombination = null;

        if (allOptionsSelected) {
                if (productData.hasVariations) {
                finalCombination = productData.variationCombinations.find(c => 
                    productData.variations.every(v => c.combination[v.type] === selectedOptions[v.type])
                );
            } else {
                finalCombination = { price: productData.price, stock: productData.stock, combination: null, imageUrl: productData.imageUrl };
            }

            if (finalCombination) {
                priceEl.textContent = `৳${finalCombination.price}`;
                if(oldPriceEl) oldPriceEl.textContent = ''; 
                stockEl.textContent = isPopup ? `Stock: ${finalCombination.stock}` : (finalCombination.stock > 0 ? 'In Stock' : 'Out of Stock');
                if (imageEl && finalCombination.imageUrl) imageEl.src = finalCombination.imageUrl;

                if (selectedVariationEl) {
                    selectedVariationEl.textContent = productData.hasVariations ? `Selected: ${Object.values(selectedOptions).join(', ')}` : 'Standard Product';
                }
                if (confirmBtn) {
                    const canConfirm = finalCombination.stock >= currentProductState.popupQuantity;
                    confirmBtn.disabled = !canConfirm;
                    confirmBtn.textContent = canConfirm ? 'Confirm' : 'Out of Stock';
                }
            } else { 
                const basePrice = productData.basePrice !== undefined ? productData.basePrice : productData.price;
                priceEl.textContent = `৳${basePrice}`;
                stockEl.textContent = 'Unavailable';
                if (selectedVariationEl) selectedVariationEl.textContent = 'Combination unavailable';
                if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Unavailable'; }
            }
        } else { 
            const basePrice = productData.basePrice !== undefined ? productData.basePrice : productData.price;
            priceEl.textContent = `৳${basePrice}`;
                if (oldPriceEl) { 
                if (productData.oldPrice && productData.oldPrice > basePrice) {
                    oldPriceEl.textContent = `৳${productData.oldPrice}`;
                } else {
                    oldPriceEl.textContent = '';
                }
            }
            stockEl.textContent = 'Select all options';
            if (selectedVariationEl) selectedVariationEl.textContent = 'Please select a variation';
            if (confirmBtn) { 
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Select Options';
            }
        }
        
        if (!isPopup) {
            currentProductState.selectedCombination = finalCombination;
            const stickyBar = document.getElementById('product-view-sticky-bar');
            if(!stickyBar) return;
            
            const overallStock = finalCombination ? finalCombination.stock : productData.stock;

            if (overallStock <= 0 && !allOptionsSelected) {
                stickyBar.innerHTML = `<button class="flex-1 bg-gray-400 text-white py-3 rounded-full cursor-not-allowed" disabled>Out of Stock</button>`;
            } else {
                stickyBar.innerHTML = `
                    <button class="w-16 h-12 flex items-center justify-center text-primary-color text-2xl"><i class="fas fa-store"></i></button>
                    <button onclick="window.buyNow()" class="flex-1 bg-blue-500 text-white py-3 rounded-full font-bold">Buy Now</button>
                    <button onclick="window.addToCart()" class="flex-1 bg-primary text-white py-3 rounded-full font-bold">Add to Cart</button>`;
            }
        }
        if (isPopup) {
            currentProductState.popupSelectedCombination = finalCombination;
        }
    };

    const handleVariationSelection = (e, context) => {
        if (!e.target.matches('.variation-option')) return;
        const isPopup = context === 'popup';
        const selectedOptions = isPopup ? currentProductState.popupSelectedOptions : currentProductState.selectedOptions;

        const { type, value } = e.target.dataset;
        const wasActive = e.target.classList.contains('active');
        
        e.target.parentElement.querySelectorAll('.variation-option').forEach(btn => btn.classList.remove('active'));

        if (wasActive) {
            delete selectedOptions[type];
        } else {
            selectedOptions[type] = value;
            e.target.classList.add('active');
        }
        updateVariationView(context);
    };

    window.viewProduct = async (productId, addToHistory = true) => { 
        if(addToHistory) showSection('product-view', productId);
        const contentDiv = document.getElementById('product-view-content'), stickyBar = document.getElementById('product-view-sticky-bar'); 
        contentDiv.innerHTML = `<div class="text-center py-16"><div class="loading-spinner mx-auto"></div></div>`; 
        stickyBar.innerHTML = ''; 
        document.getElementById('product-reviews-section').innerHTML = ''; 
        document.getElementById('recommended-products-section').classList.add('hidden');

        const docSnap = await getDoc(doc(db, "products", productId)); 
        if (docSnap.exists()) { 
            const product = {id: docSnap.id, ...docSnap.data()}; 

// ১. টাইটেল এবং মেটা ডেসক্রিপশন আপডেট
const pageTitle = `${product.name} | Chilmari E Shop`;
document.title = pageTitle;
const metaDescEl = document.getElementById('meta-desc');
if (metaDescEl) metaDescEl.setAttribute("content", (product.description || product.name || '').substring(0, 160));

// ১b. Canonical — প্রোডাক্টের নিজস্ব URL (হোমপেজ নয়) ✅ SEO FIX
const productUrl = `https://chilmarieshop.top/product-view/${productId}`;
let canonicalEl = document.getElementById('canonical-link') || document.querySelector('link[rel="canonical"]');
if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.rel = 'canonical';
    canonicalEl.id = 'canonical-link';
    document.head.appendChild(canonicalEl);
}
canonicalEl.setAttribute('href', productUrl);

// ২. ফেসবুক শেয়ারিং মেটা ট্যাগ আপডেট
const ogTitle = document.getElementById('og-title');
const ogDesc = document.getElementById('og-desc');
const ogImage = document.getElementById('og-image');
if (ogTitle) ogTitle.content = pageTitle;
if (ogDesc) ogDesc.content = (product.description || product.name || '').substring(0, 100);
if (ogImage) ogImage.content = product.imageUrl || '';

// ৩. গুগল শপিং স্কিমা (JSON-LD) আপডেট
const schemaData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": product.imageUrl,
    "description": product.description,
    "url": productUrl,
    "offers": {
        "@type": "Offer",
        "priceCurrency": "BDT",
        "price": product.basePrice || product.price,
        "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "url": productUrl
    }
};
const schemaEl = document.getElementById('product-schema');
if (schemaEl) schemaEl.textContent = JSON.stringify(schemaData);
            
            // Tracking & state
            currentProductState = { ...currentProductState, productData: product, selectedOptions: {}, selectedCombination: null };
            const imageUrls = product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : [product.imageUrl]; 
            const isInWishlist = userWishlist.includes(productId); 
            
            let variationsHTML = '';
            if(product.hasVariations) {
                variationsHTML = `<div class="bg-white p-4 mt-2" id="variation-selector">` + 
                product.variations.map(vt => `<div class="variation-group mb-3" data-variation-type="${escapeHtml(vt.type)}"><p class="font-semibold text-sm mb-2">${escapeHtml(vt.type)}</p><div class="flex flex-wrap gap-2">${vt.options.map(opt => `<button class="variation-option border px-4 py-2 rounded text-sm" data-type="${escapeHtml(vt.type)}" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}</div></div>`).join('') + `</div>`;
            }
            
            const descriptionHTML = (product.description || 'No description available.').replace(/\n/g, '<br>');

            contentDiv.innerHTML = `
                <div class="swiper-container" id="product-image-swiper"><div class="swiper-wrapper">${imageUrls.map(url => `<div class="swiper-slide"><img src="${escapeHtml(url)}" class="w-full h-full object-contain" loading="lazy"></div>`).join('')}</div><div class="swiper-pagination"></div><div class="swiper-counter absolute bottom-2 right-3 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded-full z-10"></div></div>
                <div class="bg-white p-4">
                    <div id="product-price-container" class="flex items-center gap-2">
                            <span class="text-2xl font-bold text-primary-color" id="product-price-display"></span>
                            <span class="text-md text-gray-400 line-through" id="product-old-price-display"></span>
                    </div>
                    <h1 class="text-lg font-medium text-gray-800 mt-1">${escapeHtml(product.name)}</h1>
                    <div class="flex items-center justify-between text-sm text-gray-500 mt-2">
                        <span><i class="fas fa-star text-yellow-400"></i> ${product.avgRating?.toFixed(1) || 'No Ratings'} (${product.reviewCount || 0})</span>
                        <span id="product-stock-display">${(product.stock || 0) > 0 ? 'In Stock' : 'Out of Stock'}</span>
                        <button class="wishlist-btn ${isInWishlist ? 'text-red-500' : 'text-gray-500'} cursor-pointer" data-productid="${productId}" onclick="event.stopPropagation(); window.toggleWishlist('${productId}')"><i class="wishlist-btn-icon ${isInWishlist ? 'fas' : 'far'} fa-heart mr-1"></i> Wishlist</button>
                        <button class="text-gray-500 cursor-pointer flex items-center gap-1" onclick="window.shareProduct('${productId}', '${escapeHtml(product.name)}', '${escapeHtml(product.imageUrl)}')"><i class="fas fa-share-alt mr-1"></i> Share</button>
                    </div>
                </div>
                ${variationsHTML}
                <div class="bg-white p-4 mt-2"><h3 class="font-bold text-gray-700 mb-2">Details</h3><p class="text-sm text-gray-600 leading-relaxed">${descriptionHTML}</p></div>`; 
            
            const basePrice = product.basePrice !== undefined ? product.basePrice : product.price;
            document.getElementById('product-price-display').textContent = `৳${basePrice}`;
            const oldPriceEl = document.getElementById('product-old-price-display');
            if (product.oldPrice && product.oldPrice > basePrice) {
                oldPriceEl.textContent = `৳${product.oldPrice}`;
            } else {
                oldPriceEl.textContent = '';
            }

            const swiperCounter = document.querySelector('#product-image-swiper .swiper-counter');
            const updateCounter = (swiperInstance) => { if (swiperCounter && swiperInstance.slides.length > 0) swiperCounter.textContent = `${swiperInstance.realIndex + 1} / ${swiperInstance.slides.length}`; };
            const swiper = new Swiper('#product-image-swiper', { pagination: { el: '.swiper-pagination', clickable: true }, on: { init: updateCounter, slideChange: updateCounter, click: (swiper) => initializeZoomSwiper(imageUrls, swiper.clickedIndex) } });
            currentProductState.productImageSwiper = swiper;

            if (product.hasVariations) {
                contentDiv.addEventListener('click', (e) => handleVariationSelection(e, 'page'));
            } 
            updateVariationView('page'); 

            listenToReviews(productId); 
            renderRecommendedProducts(productId, product.category);
        } 
    };

    const listenToReviews = (productId) => { if (reviewsUnsubscribe) reviewsUnsubscribe(); const q = query(collection(db, `products/${productId}/reviews`), orderBy('createdAt', 'desc')); reviewsUnsubscribe = onSnapshot(q, (snapshot) => renderReviewsSection(productId, snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}))) ); };
    
// --- UPDATED RENDER REVIEWS (CHILMARI-ESHOP STYLE) ---
    const renderReviewsSection = (productId, reviews) => { 
        const container = document.getElementById('product-reviews-section'); 
        
        // Calculate Average
        const totalReviews = reviews.length;
        const avgRating = totalReviews > 0 
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1) 
            : 0;

        // Header HTML with "See All Reviews" button
        const headerHTML = `
            <div class="flex justify-between items-start mb-4 border-b pb-4">
                <div>
                    <h3 class="font-bold text-gray-700">Ratings & Reviews (${totalReviews})</h3>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-3xl font-bold text-gray-800">${avgRating}/5</span>
                        <div class="display-stars text-xl text-yellow-400">${renderStars(avgRating)}</div>
                    </div>
                </div>
                <button onclick="window.openAllReviewsPage('${productId}')" 
                    class="bg-gray-100 text-gray-700 text-xs px-3 py-2 rounded font-medium border border-gray-200 hover:bg-gray-200">
                    <i class="fas fa-list mr-1"></i> See All Reviews
                </button>
            </div>
        `;

        if(reviews.length === 0) {
            container.innerHTML = headerHTML + `<div class="text-center py-6 text-gray-400 text-sm">No reviews yet. Be the first to review!</div>`;
            container.style.display = 'block';
            return;
        }

        // Generate List HTML
        let reviewsHTML = reviews.map(review => {
            // Image Gallery HTML
            let imagesHtml = '';
            if (review.images && review.images.length > 0) {
                imagesHtml = `
                    <div class="review-gallery">
                        ${review.images.map(img => `<img src="${img}" onclick="window.openImageZoom('${img}')">`).join('')}
                    </div>`;
            }

            return `
            <div class="py-4 border-b last:border-0">
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-2 mb-1">
                        <div class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            ${review.userAvatar ? `<img src="${review.userAvatar}" referrerpolicy="no-referrer" class="w-full h-full object-cover" onerror="this.onerror=null;this.style.display='none'">` : `<i class="fas fa-user text-xs text-gray-400"></i>`}
                        </div>
                        <span class="text-xs text-gray-500">${escapeHtml(review.userName || 'Anonymous')}</span>
                    </div>
                    <span class="text-[10px] text-gray-400">${review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                </div>
                
                <div class="display-stars text-xs text-yellow-400 mb-1">${renderStars(review.rating)}</div>
                
                <p class="text-sm text-gray-700 leading-snug">${escapeHtml(review.reviewText)}</p>
                ${review.adminReply ? `
                <div class="mt-3 ml-2">
                    <div class="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <div class="flex-shrink-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                            <i class="fas fa-store text-white text-xs"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center gap-1 mb-1">
                                <span class="text-xs font-bold text-primary-color">Seller Reply</span>
                                <i class="fas fa-check-circle text-xs text-primary-color"></i>
                            </div>
                            <p class="text-xs text-gray-700 leading-relaxed">${escapeHtml(review.adminReply)}</p>
                        </div>
                    </div>
                </div>` : ''}
                
                ${imagesHtml}
                
                <!-- Facebook-style comment section -->
                <div class="fb-comment-section" id="fbcs-${review.id}" data-pid="${productId}" data-rid="${review.id}" data-page="0">
                    <div id="fb-comments-list-${review.id}">
                        <div class="fb-time" style="color:#bbb;font-size:10px;">মন্তব্য লোড হচ্ছে...</div>
                    </div>
                    <div class="fb-input-row">
                        <div class="fb-avatar" style="width:28px;height:28px;font-size:10px;" id="fb-self-av-${review.id}">
                            <i class="fas fa-user" style="font-size:10px;"></i>
                        </div>
                        <input class="fb-input" id="fb-inp-${review.id}" placeholder="মন্তব্য করুন..." />
                        <button class="fb-send-btn" onclick="window.fbSubmitComment('${productId}','${review.id}',false)">
                            <i class="fas fa-paper-plane" style="font-size:11px;"></i>
                        </button>
                    </div>
                </div>
                
            </div>`;
        }).join(''); 

        container.innerHTML = headerHTML + `<div id="reviews-list" class="space-y-1">${reviewsHTML}</div>`;
        container.style.display = 'block';

        // Load comments for all reviews & update self avatar
        const user = auth.currentUser;
        reviews.forEach(review => {
            window.fbLoadComments(productId, review.id, false);
            // Update self avatar in comment box
            const avEl = document.getElementById(`fb-self-av-${review.id}`);
            if (avEl && user) {
                if (user.photoURL) {
                    avEl.innerHTML = `<img src="${user.photoURL}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\"fas fa-user\\" style=\\"font-size:10px;\\"></i>'">`;
                } else {
                    avEl.textContent = (user.displayName||'U').charAt(0).toUpperCase();
                }
            }
        });
    };

    // Helper for image zoom
    window.openImageZoom = (src) => {
        initializeZoomSwiper([src], 0);
    };

    // ═══════════════════════════════════════════════════════
    // ── FACEBOOK-STYLE COMMENT SYSTEM ──────────────────────
    // ═══════════════════════════════════════════════════════

    // Time ago helper
    const fbTimeAgo = (date) => {
        if (!date) return 'এইমাত্র';
        const d = date.toDate ? date.toDate() : new Date(date);
        const diff = Math.floor((Date.now() - d.getTime()) / 1000);
        if (diff < 60) return 'এইমাত্র';
        if (diff < 3600) return `${Math.floor(diff/60)} মিনিট আগে`;
        if (diff < 86400) return `${Math.floor(diff/3600)} ঘণ্টা আগে`;
        return `${Math.floor(diff/86400)} দিন আগে`;
    };

    // Build avatar HTML (Google photo safe)
    const fbAvatarHtml = (photoURL, name, size = 32) => {
        const letter = (name||'U').charAt(0).toUpperCase();
        if (photoURL) {
            return `<img src="${photoURL}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null;this.parentElement.innerHTML='${letter}'" loading="lazy">`;
        }
        return letter;
    };

    // Render single comment bubble
    const fbRenderComment = (c, productId, reviewId, isAR) => {
        const isAdmin = c.role === 'admin' || c.role === 'seller';
        const prefix = isAR ? 'ar-' : '';
        const nestedId = `fb-nested-${c.id}`;
        return `
        <div class="fb-comment-item" id="fb-citem-${c.id}">
            <div class="fb-avatar" style="${isAdmin ? 'background:#dc2626;' : 'background:#9ca3af;'}">
                ${fbAvatarHtml(c.photoURL, c.userName)}
            </div>
            <div style="flex:1;min-width:0;">
                <div class="fb-bubble ${isAdmin ? 'seller-bubble' : ''}">
                    <span class="fb-bubble-name ${isAdmin ? 'seller-name' : ''}">
                        ${escapeHtml(c.userName || 'Anonymous')}
                        ${isAdmin ? '<span class="seller-badge">Seller</span>' : ''}
                    </span>
                    <div class="fb-bubble-text">${escapeHtml(c.text || '')}</div>
                </div>
                <div class="fb-meta">
                    <span class="fb-time">${fbTimeAgo(c.createdAt)}</span>
                    <button class="fb-reply-btn" onclick="window.fbShowReplyBox('${c.id}','${escapeHtml(c.userName||'User')}','${productId}','${reviewId}',${isAR})">উত্তর দিন</button>
                </div>
                <div id="${nestedId}"></div>
            </div>
        </div>`;
    };

    // Load and display comments for a review
    window.fbLoadComments = async (productId, reviewId, isAR) => {
        const prefix = isAR ? 'ar-' : '';
        const listEl = document.getElementById(`${prefix}fb-comments-list-${reviewId}`);
        if (!listEl) return;

        try {
            const ref = collection(db, `products/${productId}/reviews/${reviewId}/comments`);
            const q = query(ref, orderBy('createdAt', 'asc'));
            const snap = await getDocs(q);

            if (snap.empty) {
                listEl.innerHTML = '';
                return;
            }

            const allComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Separate top-level and nested replies
            const topLevel = allComments.filter(c => !c.parentId);
            const replies = allComments.filter(c => c.parentId);

            const SHOW_FIRST = 2;
            const visibleTop = topLevel.slice(0, SHOW_FIRST);
            const hiddenTop = topLevel.slice(SHOW_FIRST);

            let html = visibleTop.map(c => fbRenderComment(c, productId, reviewId, isAR)).join('');

            if (hiddenTop.length > 0) {
                html += `<button class="fb-show-more" onclick="window.fbShowAll('${productId}','${reviewId}',${isAR})">
                    <i class="fas fa-chevron-down" style="font-size:9px;"></i> আরো ${hiddenTop.length}টি মন্তব্য দেখুন
                </button>`;
            }

            listEl.innerHTML = html;

            // Inject nested replies
            replies.forEach(reply => {
                const nestedEl = document.getElementById(`fb-nested-${reply.parentId}`);
                if (nestedEl) {
                    nestedEl.innerHTML += fbRenderComment(reply, productId, reviewId, isAR);
                }
            });

        } catch (err) {
            console.error('Comment load error:', err);
            listEl.innerHTML = '';
        }
    };

    // Show all comments (when "আরো দেখুন" clicked)
    window.fbShowAll = async (productId, reviewId, isAR) => {
        const prefix = isAR ? 'ar-' : '';
        const listEl = document.getElementById(`${prefix}fb-comments-list-${reviewId}`);
        if (!listEl) return;
        listEl.innerHTML = `<div class="fb-time" style="color:#bbb;">লোড হচ্ছে...</div>`;
        try {
            const ref = collection(db, `products/${productId}/reviews/${reviewId}/comments`);
            const snap = await getDocs(query(ref, orderBy('createdAt', 'asc')));
            const allComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const topLevel = allComments.filter(c => !c.parentId);
            const replies = allComments.filter(c => c.parentId);
            listEl.innerHTML = topLevel.map(c => fbRenderComment(c, productId, reviewId, isAR)).join('');
            replies.forEach(reply => {
                const nestedEl = document.getElementById(`fb-nested-${reply.parentId}`);
                if (nestedEl) nestedEl.innerHTML += fbRenderComment(reply, productId, reviewId, isAR);
            });
        } catch(e) { console.error(e); }
    };

    // Show reply input box under a specific comment
    window.fbShowReplyBox = (commentId, replyToName, productId, reviewId, isAR) => {
        // Remove any existing reply boxes
        document.querySelectorAll('.fb-reply-input-row').forEach(el => el.remove());
        
        const nestedEl = document.getElementById(`fb-nested-${commentId}`);
        if (!nestedEl) return;

        const user = auth.currentUser;
        const avHtml = user 
            ? (user.photoURL 
                ? `<img src="${user.photoURL}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null;this.parentElement.innerHTML='${(user.displayName||'U').charAt(0).toUpperCase()}'">` 
                : (user.displayName||'U').charAt(0).toUpperCase())
            : '?';

        const div = document.createElement('div');
        div.className = 'fb-input-row fb-reply-input-row';
        div.style.marginTop = '6px';
        div.innerHTML = `
            <div class="fb-avatar" style="width:26px;height:26px;font-size:10px;">${avHtml}</div>
            <input class="fb-input" id="fb-rinp-${commentId}" placeholder="@${replyToName} কে উত্তর দিন..." style="font-size:11px;padding:6px 12px;" />
            <button class="fb-send-btn" style="width:28px;height:28px;" onclick="window.fbSubmitReply('${productId}','${reviewId}','${commentId}',${isAR})">
                <i class="fas fa-paper-plane" style="font-size:10px;"></i>
            </button>
        `;
        nestedEl.appendChild(div);
        div.querySelector('input')?.focus();
    };

    // Submit top-level comment
    window.fbSubmitComment = async (productId, reviewId, isAR) => {
        const prefix = isAR ? 'ar-' : '';
        const input = document.getElementById(`${prefix}fb-inp-${reviewId}`);
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        const user = auth.currentUser;
        if (!user) {
            showToast('মন্তব্য করতে লগইন করুন!', '#ef4444');
            return;
        }

        const btn = input.nextElementSibling;
        input.value = '';
        input.disabled = true;
        if (btn) btn.disabled = true;

        try {
            const ref = collection(db, `products/${productId}/reviews/${reviewId}/comments`);
            await addDoc(ref, {
                userId: user.uid,
                userName: user.displayName || 'Customer',
                photoURL: user.photoURL || null,
                role: 'customer',
                text: text,
                parentId: null,
                createdAt: serverTimestamp()
            });
            await window.fbLoadComments(productId, reviewId, isAR);
        } catch (err) {
            console.error('Comment submit error:', err);
            showToast('মন্তব্য পাঠাতে সমস্যা! Firebase Rules চেক করুন।', '#ef4444');
        } finally {
            input.disabled = false;
            if (btn) btn.disabled = false;
        }
    };

    // Submit nested reply
    window.fbSubmitReply = async (productId, reviewId, parentCommentId, isAR) => {
        const input = document.getElementById(`fb-rinp-${parentCommentId}`);
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        const user = auth.currentUser;
        if (!user) {
            showToast('উত্তর দিতে লগইন করুন!', '#ef4444');
            return;
        }

        input.value = '';
        input.disabled = true;

        try {
            const ref = collection(db, `products/${productId}/reviews/${reviewId}/comments`);
            await addDoc(ref, {
                userId: user.uid,
                userName: user.displayName || 'Customer',
                photoURL: user.photoURL || null,
                role: 'customer',
                text: text,
                parentId: parentCommentId,
                createdAt: serverTimestamp()
            });
            document.querySelectorAll('.fb-reply-input-row').forEach(el => el.remove());
            await window.fbLoadComments(productId, reviewId, isAR);
        } catch (err) {
            console.error('Reply submit error:', err);
            showToast('উত্তর পাঠাতে সমস্যা! Firebase Rules চেক করুন।', '#ef4444');
        }
    };

    // ═══════════════════════════════════════════════════════

    // ── Product Share ────────────────────────────────────────────────
    window.shareProduct = (productId, productName, productImage) => {
        const shareUrl = `${window.location.origin}/${productId}`;
        if (navigator.share) {
            navigator.share({ title: productName, text: `দেখুন এই পণ্যটি: ${productName}`, url: shareUrl })
                .catch(() => {});
        } else {
            navigator.clipboard.writeText(shareUrl).then(() => showToast('🔗 লিংক কপি হয়েছে!', '#10b981'));
        }
    };

    // ── Similar / Recommended Products (Enhanced) ──────────────────
    const renderRecommendedProducts = async (currentProductId, currentCategory) => {
        const container = document.getElementById('recommended-products-container');
        const section = document.getElementById('recommended-products-section');
        const heading = section?.querySelector('h3');
        if (heading) heading.textContent = '🛍️ একই ক্যাটাগরির পণ্য';
        container.innerHTML = renderSkeletonLoader(4);
        section.classList.remove('hidden');

        try {
            const q = query(collection(db, "products"), where("category", "==", currentCategory), limit(12));
            const snapshot = await getDocs(q);
            let recommended = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(p => p.id !== currentProductId)
                .slice(0, 6);

            if (recommended.length > 0) {
                container.innerHTML = recommended.map(p => renderProductCard(p.id, p)).join('');
            } else {
                section.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error fetching recommended products:", error);
            section.classList.add('hidden');
        }
    };

    const renderStars = (rating) => { let stars = ''; for (let i = 1; i <= 5; i++) { stars += `<i class="fas fa-star ${i <= Math.round(rating) ? '' : 'empty'}"></i>`; } return stars; };

    // ── Notification System (Read/Unread + Orange Blink) ──────────────
    const getLastReadTime = () => parseInt(localStorage.getItem('lastReadNotifTime') || '0');
    const setLastReadTime = (ts) => localStorage.setItem('lastReadNotifTime', ts);

    // Background listener — always running, shows unread count + blink
    const startNotificationListener = () => {
        const dot = document.getElementById('notification-dot');
        const bellBtn = document.getElementById('notification-bell-btn');
        const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(30));

        return onSnapshot(q, (snapshot) => {
            if (snapshot.empty) { dot.classList.add('hidden'); return; }
            const lastRead = getLastReadTime();
            const uid = auth.currentUser?.uid;
            const unread = snapshot.docs.filter(d => {
                const data = d.data();
                if (data.userId && data.userId !== uid) return false; // skip other users
                const ts = data.createdAt?.seconds || 0;
                return ts > lastRead;
            }).length;

            if (unread > 0) {
                dot.textContent = unread > 9 ? '9+' : unread;
                dot.classList.remove('hidden');
                dot.classList.add('notif-blink');
                bellBtn.classList.add('notif-bell-pulse');
                setTimeout(() => bellBtn.classList.remove('notif-bell-pulse'), 1800);
            } else {
                dot.classList.add('hidden');
                dot.classList.remove('notif-blink');
            }
        });
    };

    // current active notif tab
    let currentNotifTab = 'all';

    const listenToNotifications = () => {
        const list = document.getElementById('notifications-list');
        const emptyView = document.getElementById('notifications-empty-view');
        const dot = document.getElementById('notification-dot');
        list.innerHTML = `<div class="text-center py-16"><div class="loading-spinner mx-auto"></div></div>`;
        emptyView.classList.add('hidden');

        if (notificationsUnsubscribe) notificationsUnsubscribe();

        const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));

        notificationsUnsubscribe = onSnapshot(q, (snapshot) => {
            renderNotifByTab(snapshot, currentNotifTab);
            // Mark all as read
            if (!snapshot.empty) {
                const latestTs = snapshot.docs[0].data().createdAt?.seconds || 0;
                setLastReadTime(latestTs);
                dot.classList.add('hidden');
                dot.classList.remove('notif-blink');
            }
        }, () => {
            list.innerHTML = '<p class="text-center text-red-500">বার্তা লোড করা যায়নি।</p>';
        });

        // Tab click handlers
        document.querySelectorAll('.notif-tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.notif-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentNotifTab = btn.dataset.notifTab;
                // Re-render from cached snapshot — re-trigger by just filtering
                if (notificationsUnsubscribe) notificationsUnsubscribe();
                listenToNotificationsFiltered(currentNotifTab);
            };
        });
    };

    const listenToNotificationsFiltered = (tabType) => {
        const list = document.getElementById('notifications-list');
        const emptyView = document.getElementById('notifications-empty-view');
        list.innerHTML = `<div class="text-center py-16"><div class="loading-spinner mx-auto"></div></div>`;

        const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
        notificationsUnsubscribe = onSnapshot(q, (snapshot) => {
            renderNotifByTab(snapshot, tabType);
        });
    };

    const renderNotifByTab = (snapshot, tabType) => {
        const list = document.getElementById('notifications-list');
        const emptyView = document.getElementById('notifications-empty-view');
        const lastRead = getLastReadTime();
        const uid = auth.currentUser?.uid;

        if (snapshot.empty) {
            list.innerHTML = '';
            emptyView.classList.remove('hidden');
            return;
        }

        let filtered = snapshot.docs.filter(d => {
            const data = d.data();
            return !data.userId || data.userId === uid;
        });

        // Tab filter
        if (tabType === 'promo') {
            filtered = filtered.filter(d => ['promo', 'offer'].includes(d.data().type));
        } else if (tabType === 'order') {
            filtered = filtered.filter(d => ['order', 'delivery'].includes(d.data().type));
        } else if (tabType === 'sms') {
            filtered = filtered.filter(d => d.data().type === 'sms');
        }
        // 'all' — no filter

        if (filtered.length === 0) {
            list.innerHTML = '';
            emptyView.classList.remove('hidden');
            return;
        }

        emptyView.classList.add('hidden');
        list.innerHTML = filtered.map(d => renderNotificationCard(d.id, d.data(), lastRead)).join('');
    };

    const renderNotificationCard = (id, notif, lastReadTs = 0) => {
        const ts = notif.createdAt?.seconds || 0;
        const isNew = ts > lastReadTs;
        const timeAgo = notif.createdAt?.toDate ? formatTimeAgo(notif.createdAt.toDate()) : '';
        const iconMap = {
            order: '📦', promo: '🎁', offer: '🎁', alert: '⚠️', info: 'ℹ️', delivery: '🚚', sms: '💬'
        };
        const icon = iconMap[notif.type] || '🔔';
        return `
        <div class="bg-white rounded-xl p-3 shadow-sm flex gap-3 relative overflow-hidden ${isNew ? 'border-l-4 border-orange-400' : ''}">
            ${isNew ? `<div class="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-400"></div>` : ''}
            <div class="flex-shrink-0 w-12 h-12 rounded-xl ${isNew ? 'bg-orange-50' : 'bg-gray-50'} flex items-center justify-center text-2xl">
                ${notif.imageUrl ? `<img src="${escapeHtml(notif.imageUrl)}" class="w-12 h-12 rounded-xl object-cover">` : icon}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                    <h4 class="font-bold text-sm text-gray-800 leading-tight">${escapeHtml(notif.title)}</h4>
                    ${isNew ? `<span class="flex-shrink-0 text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">নতুন</span>` : ''}
                </div>
                <p class="text-xs text-gray-600 mt-0.5 leading-relaxed">${escapeHtml(notif.message)}</p>
                <p class="text-[10px] text-gray-400 mt-1">${timeAgo}</p>
            </div>
        </div>`;
    };

    const formatTimeAgo = (date) => {
        const diff = Math.floor((Date.now() - date.getTime()) / 1000);
        if (diff < 60) return 'এইমাত্র';
        if (diff < 3600) return `${Math.floor(diff/60)} মিনিট আগে`;
        if (diff < 86400) return `${Math.floor(diff/3600)} ঘণ্টা আগে`;
        if (diff < 604800) return `${Math.floor(diff/86400)} দিন আগে`;
        return date.toLocaleDateString('bn-BD');
    };
    
    document.getElementById('notification-bell-btn').addEventListener('click', () => showSection('notifications'));
    // Background notification listener — always on for logged in users
    let notifBgUnsubscribe = null;


    const updateCartCount = () => { const count = userCart.reduce((sum, item) => sum + item.quantity, 0); document.getElementById('cart-count').textContent = count; document.getElementById('cart-count').style.display = count > 0 ? 'flex' : 'none'; };
    const getCartItemId = (productId, variation = null) => { if (!variation || Object.keys(variation).length === 0) return productId; const sortedKeys = Object.keys(variation).sort(); const variationString = sortedKeys.map(key => `${key}-${variation[key]}`).join('_'); return `${productId}_${variationString}`; }
    
    window.addToCart = () => openVariationPopup('addToCart');
    window.buyNow = () => openVariationPopup('buyNow');
    
    const _performAddToCart = async () => {
        if (!auth.currentUser) { closeVariationPopup(); return showLoginModal(); }
        const { productData, popupSelectedCombination, popupQuantity } = currentProductState;
        
        const itemToAdd = { 
            productId: productData.id, name: productData.name, 
            variation: popupSelectedCombination ? popupSelectedCombination.combination : null, 
            price: popupSelectedCombination ? popupSelectedCombination.price : productData.price, 
            imageUrl: (popupSelectedCombination && popupSelectedCombination.imageUrl) ? popupSelectedCombination.imageUrl : productData.imageUrl, 
            stock: popupSelectedCombination ? popupSelectedCombination.stock : productData.stock 
        };
        
        const cartItemId = getCartItemId(itemToAdd.productId, itemToAdd.variation);
        const cartItemRef = doc(db, `users/${auth.currentUser.uid}/cartItems`, cartItemId);

        try {
            await runTransaction(db, async (transaction) => {
                const cartDoc = await transaction.get(cartItemRef);
                const currentQty = cartDoc.exists() ? cartDoc.data().quantity : 0;
                
                if (itemToAdd.stock < (currentQty + popupQuantity)) {
                    throw new Error('Not enough stock.');
                }
                
                const newItemData = {
                    ...itemToAdd,
                    quantity: currentQty + popupQuantity,
                    addedAt: serverTimestamp()
                };
                transaction.set(cartItemRef, newItemData, { merge: true });
            });
            showToast('Added to cart!');
            closeVariationPopup();
        } catch (e) {
            console.error("Add to cart error:", e);
            showToast(e.message || 'Failed to add to cart.', '#ef4444');
        }
    };

    const _performBuyNow = async () => {
        if (!auth.currentUser) { closeVariationPopup(); return showLoginModal(); }
        const { productData, popupSelectedCombination, popupQuantity } = currentProductState;
        const itemToBuy = { productId: productData.id, name: productData.name, variation: popupSelectedCombination ? popupSelectedCombination.combination : null, price: popupSelectedCombination ? popupSelectedCombination.price : productData.price, imageUrl: (popupSelectedCombination && popupSelectedCombination.imageUrl) ? popupSelectedCombination.imageUrl : productData.imageUrl, stock: popupSelectedCombination ? popupSelectedCombination.stock : productData.stock, quantity: popupQuantity };
        if (itemToBuy.stock < popupQuantity) return showToast('Not enough stock.', '#ef4444');
        
        sessionStorage.setItem('buyNowItem', JSON.stringify(itemToBuy));
        // Set digital flag
        sessionStorage.setItem('isDigitalCheckout', productData.isDigital ? 'true' : 'false');
        closeVariationPopup();
        showSection('checkout');
    };

    window.updateCartQuantity = async (cartItemId, change) => { 
        if (!auth.currentUser) return; 
        
        const cartSection = document.getElementById('cart-items');
        cartSection.style.opacity = '0.5';
        cartSection.style.pointerEvents = 'none';

        const cartItemRef = doc(db, `users/${auth.currentUser.uid}/cartItems`, cartItemId); 
        try { 
            await runTransaction(db, async (transaction) => { 
                const cartDoc = await transaction.get(cartItemRef); 
                if (!cartDoc.exists()) return; 
                const data = cartDoc.data(); 
                const newQuantity = data.quantity + change; 
                if (newQuantity > data.stock) throw new Error("Not enough stock available."); 
                if (newQuantity > 0) transaction.update(cartItemRef, { quantity: newQuantity }); 
                else transaction.delete(cartItemRef); 
            }); 
        } catch(e) { 
            showToast(e.message || 'Failed to update cart.', '#ef4444'); 
        } finally {
            cartSection.style.opacity = '1';
            cartSection.style.pointerEvents = 'auto';
        }
    }

    window.deleteFromCart = async (cartItemId) => { if (!auth.currentUser) return; if(confirm('Are you sure you want to remove this item?')) { try { await deleteDoc(doc(db, `users/${auth.currentUser.uid}/cartItems`, cartItemId)); } catch(e) { showToast('Failed to delete item.', '#ef4444'); } } };
    
    const renderCart = () => { 
        updateCartCount(); const emptyView = document.getElementById('cart-empty-view'), itemsContainer = document.getElementById('cart-items'), summaryContainer = document.getElementById('cart-summary');
        if (userCart.length === 0) { itemsContainer.innerHTML = ''; emptyView.classList.remove('hidden'); summaryContainer.classList.add('hidden'); return; } 
        emptyView.classList.add('hidden'); summaryContainer.classList.remove('hidden'); 
        const subtotal = userCart.reduce((sum, item) => sum + (item.price * item.quantity), 0); 
        itemsContainer.innerHTML = userCart.map(item => {
            let variationText = '';
            if (item.variation && typeof item.variation === 'object') {
                variationText = `<span class="text-xs text-gray-500 block mt-1">${Object.entries(item.variation).map(([key, value]) => `${key}: ${value}`).join(', ')}</span>`;
            }
            return `<div class="bg-white rounded p-3 flex items-start"><img src="${escapeHtml(item.imageUrl)}" class="w-20 h-20 object-cover rounded mr-3" loading="lazy" onclick="window.viewProduct('${item.productId}')"><div class="flex-1"><h4 class="text-sm font-medium text-gray-800 line-clamp-2" onclick="window.viewProduct('${item.productId}')">${escapeHtml(item.name)}</h4>${variationText}<p class="text-primary-color font-bold text-base mt-1">৳${item.price}</p><div class="flex items-center mt-2"><button onclick="window.updateCartQuantity('${item.id}', -1)" class="quantity-btn rounded-l">-</button><span class="px-4 py-1.5 text-sm border-t border-b">${item.quantity}</span><button onclick="window.updateCartQuantity('${item.id}', 1)" class="quantity-btn rounded-r">+</button></div></div><button onclick="window.deleteFromCart('${item.id}')" class="ml-2 text-gray-400 hover:text-red-500"><i class="fas fa-trash-alt"></i></button></div>`;
        }).join(''); 
        summaryContainer.innerHTML = `<div><span class="font-bold text-lg text-primary-color">৳${subtotal.toLocaleString()}</span></div><button onclick="showSection('checkout')" class="bg-primary text-white font-bold py-3 px-8 rounded-full glow-on-hover">Checkout (${userCart.reduce((sum, item) => sum + item.quantity, 0)})</button>`; 
    };
    
    const variationPopup = document.getElementById('variation-popup-modal');
    const openVariationPopup = (action) => {
        if (!auth.currentUser) return showLoginModal();
        const { productData, selectedOptions } = currentProductState;
        if(!productData) return; 

        currentProductState.popupAction = action;
        currentProductState.popupQuantity = 1;
        currentProductState.popupSelectedOptions = { ...selectedOptions };
        currentProductState.popupSelectedCombination = currentProductState.selectedCombination;
        
        document.getElementById('popup-product-image').src = productData.imageUrl;
        document.getElementById('popup-quantity-display').textContent = '1';
        
        const confirmBtn = document.getElementById('popup-confirm-btn');
        confirmBtn.className = 'font-bold w-full py-3'; 
        if (action === 'buyNow') {
            confirmBtn.classList.add('bg-blue-500');
                confirmBtn.style.backgroundColor = '#3b82f6';
        } else {
            confirmBtn.classList.add('bg-primary');
            confirmBtn.style.backgroundColor = 'var(--primary-color)';
        }

        const pageSelector = document.getElementById('variation-selector');
        const popupSelectorContainer = document.getElementById('popup-variation-selector');
        popupSelectorContainer.innerHTML = pageSelector ? pageSelector.innerHTML : '';
        
        if (pageSelector) {
                Object.entries(currentProductState.popupSelectedOptions).forEach(([type, value]) => {
                const btn = popupSelectorContainer.querySelector(`.variation-option[data-type="${type}"][data-value="${value}"]`);
                if (btn) btn.classList.add('active');
            });
        }

        updateVariationView('popup');
        variationPopup.classList.add('active');
    };

    const closeVariationPopup = () => {
        variationPopup.classList.remove('active');
    };

    document.getElementById('variation-popup-backdrop').addEventListener('click', closeVariationPopup);
    document.getElementById('popup-close-btn').addEventListener('click', closeVariationPopup);
    document.getElementById('popup-variation-selector').addEventListener('click', (e) => handleVariationSelection(e, 'popup'));

    document.getElementById('popup-quantity-plus').addEventListener('click', () => {
        const combination = currentProductState.popupSelectedCombination || currentProductState.productData;
        if (!combination) return;
        if (currentProductState.popupQuantity < combination.stock) {
            currentProductState.popupQuantity++;
            document.getElementById('popup-quantity-display').textContent = currentProductState.popupQuantity;
            updateVariationView('popup');
        } else {
            showToast('Maximum stock reached', '#ef4444');
        }
    });

    document.getElementById('popup-quantity-minus').addEventListener('click', () => {
        if (currentProductState.popupQuantity > 1) {
            currentProductState.popupQuantity--;
            document.getElementById('popup-quantity-display').textContent = currentProductState.popupQuantity;
            updateVariationView('popup');
        }
    });

    document.getElementById('popup-confirm-btn').addEventListener('click', () => {
        const { productData, popupAction, popupSelectedCombination } = currentProductState;
        if (productData.hasVariations && !popupSelectedCombination) {
            return showToast('Please select a valid combination.', '#ef4444');
        }
        if (popupAction === 'addToCart') {
            _performAddToCart();
        } else if (popupAction === 'buyNow') {
            _performBuyNow();
        }
    });


    const updateCheckoutSummary = () => { 
        const buyNowItemJSON = sessionStorage.getItem('buyNowItem');
        const itemsForCheckout = buyNowItemJSON ? [JSON.parse(buyNowItemJSON)] : userCart;
        if (itemsForCheckout.length === 0) return; 

        const appliedCouponJSON = sessionStorage.getItem('appliedCoupon');
        const appliedCoupon = appliedCouponJSON ? JSON.parse(appliedCouponJSON) : null;
        
        const subtotal = itemsForCheckout.reduce((sum, item) => sum + (item.price * item.quantity), 0); 

        let deliveryCost = 0;
        if (getIsDigital()) {
            deliveryCost = 10; // Digital = ৳10 flat
        } else {
            const selectedLocationRadio = document.querySelector('input[name="deliveryLocation"]:checked'); 
            if (!selectedLocationRadio) return; 
            deliveryCost = selectedLocationRadio.value === 'inside' 
                ? (storeSettings.deliveryCosts.inside || 60) 
                : (storeSettings.deliveryCosts.outside || 120); 
        }

        const discount = appliedCoupon ? appliedCoupon.discountAmount : 0; 
        const total = Math.max(0, subtotal + deliveryCost - discount); 
        document.getElementById('checkout-subtotal').textContent = `৳${subtotal.toLocaleString()}`; 
        document.getElementById('checkout-delivery-cost').textContent = `৳${deliveryCost.toLocaleString()}`; 
        const discountRow = document.getElementById('checkout-discount-row'); 
        if(appliedCoupon) { 
            document.getElementById('checkout-discount').textContent = `- ৳${discount.toLocaleString()}`; 
            discountRow.classList.remove('hidden'); 
        } else { 
            discountRow.classList.add('hidden'); 
        } 
        document.getElementById('checkout-total').textContent = `৳${total.toLocaleString()}`; 
    };
    
    const saveCheckoutFormState = () => {
        const form = {
            name: document.getElementById('delivery-name').value,
            phone: document.getElementById('delivery-phone').value,
            address: document.getElementById('delivery-address').value,
            location: document.querySelector('input[name="deliveryLocation"]:checked')?.value
        };
        sessionStorage.setItem('checkoutForm', JSON.stringify(form));
    };

    const loadCheckoutFormState = () => {
        const savedForm = JSON.parse(sessionStorage.getItem('checkoutForm') || '{}');
        document.getElementById('delivery-name').value = savedForm.name || '';
        document.getElementById('delivery-phone').value = savedForm.phone || '';
        document.getElementById('delivery-address').value = savedForm.address || '';
        if(savedForm.location) {
            const radio = document.querySelector(`input[name="deliveryLocation"][value="${savedForm.location}"]`);
            if (radio) radio.checked = true;
        }
    };

    const renderCheckout = () => { 
        const buyNowItemJSON = sessionStorage.getItem('buyNowItem');
        const itemsForCheckout = buyNowItemJSON ? [JSON.parse(buyNowItemJSON)] : userCart;
        if (itemsForCheckout.length === 0) return showSection('home');
        
        const isDigital = getIsDigital();

        if (!isDigital) {
            // Physical: setup delivery location radios
            const locationDiv = document.getElementById('delivery-location-options'); 
            locationDiv.innerHTML = `
                <label class="flex items-center p-3 border rounded-lg cursor-pointer">
                    <input type="radio" name="deliveryLocation" value="inside" class="form-radio text-primary-color ring-primary-color" checked>
                    <span class="ml-3 flex-1">Inside City</span>
                    <span class="font-bold text-primary-color">৳${storeSettings.deliveryCosts.inside || 60}</span>
                </label>
                <label class="flex items-center p-3 border rounded-lg cursor-pointer">
                    <input type="radio" name="deliveryLocation" value="outside" class="form-radio text-primary-color ring-primary-color">
                    <span class="ml-3 flex-1">Outside City</span>
                    <span class="font-bold text-primary-color">৳${storeSettings.deliveryCosts.outside || 120}</span>
                </label>`; 
            
            loadCheckoutFormState();
            document.querySelectorAll('input[name="deliveryLocation"]').forEach(radio => 
                radio.addEventListener('change', () => { saveCheckoutFormState(); updateCheckoutSummary(); })
            );
            document.getElementById('delivery-form').addEventListener('input', saveCheckoutFormState);
        }
        
        // Coupon state
        const appliedCouponJSON = sessionStorage.getItem('appliedCoupon');
        if (appliedCouponJSON) {
            const coupon = JSON.parse(appliedCouponJSON);
            document.getElementById('coupon-code-input').value = coupon.code;
            document.getElementById('coupon-code-input').disabled = true;
            document.getElementById('apply-coupon-btn').textContent = 'Remove';
        } else {
            document.getElementById('coupon-code-input').value = '';
            document.getElementById('coupon-code-input').disabled = false;
            document.getElementById('apply-coupon-btn').textContent = 'Apply';
        }

        // Toggle UI
        updateCheckoutForDigital();
        updateCheckoutSummary(); 
    };
    
    document.getElementById('apply-coupon-btn').addEventListener('click', async () => { 
        const btn = document.getElementById('apply-coupon-btn'), input = document.getElementById('coupon-code-input');
        const appliedCouponJSON = sessionStorage.getItem('appliedCoupon');
        
        if(appliedCouponJSON) { 
            sessionStorage.removeItem('appliedCoupon');
            input.value = ''; 
            input.disabled = false; 
            btn.textContent = 'Apply'; 
            showToast('Coupon removed.'); 
            updateCheckoutSummary(); 
            return; 
        } 
        
        const code = input.value.toUpperCase().trim(); 
        if (!code) return showToast('Please enter a coupon code.', '#ef4444'); 
        const couponRef = doc(db, "coupons", code), couponSnap = await getDoc(couponRef); 
        if (!couponSnap.exists()) return showToast('Invalid coupon code.', '#ef4444'); 
        const coupon = couponSnap.data(), now = new Date(), startDate = coupon.startDate.toDate(), endDate = coupon.endDate.toDate(); 
        if (now < startDate) return showToast('This coupon is not active yet.', '#ef4444'); 
        if (now > endDate) return showToast('This coupon has expired.', '#ef4444'); 
        
        const appliedCoupon = { code: couponSnap.id, ...coupon };
        sessionStorage.setItem('appliedCoupon', JSON.stringify(appliedCoupon));
        
        input.disabled = true; 
        btn.textContent = 'Remove'; 
        showToast(`Coupon applied! You saved ৳${coupon.discountAmount}.`); 
        updateCheckoutSummary(); 
    });

    document.getElementById('place-order-btn').addEventListener('click', async () => { 
    if (!auth.currentUser) return showLoginModal(); 
    
    const buyNowItemJSON = sessionStorage.getItem('buyNowItem');
    const buyNowItem = buyNowItemJSON ? JSON.parse(buyNowItemJSON) : null;
    const itemsForOrder = (buyNowItem ? [buyNowItem] : userCart).map(({ stock, ...rest }) => rest); 
    
    if (itemsForOrder.length === 0) { showSection('home'); return showToast('Your cart is empty.', '#ef4444'); } 
    
    const form = document.getElementById('delivery-form'); 
    
    const btn = document.getElementById('place-order-btn'); 
    btn.disabled = true; 
    btn.innerHTML = `<div class="loading-spinner"></div>`; 
    
    try { 
        // ১. ডাটা আগে প্রিপেয়ার করুন যাতে ট্রানজেকশনের বাইরেও পাওয়া যায়
        const appliedCouponJSON = sessionStorage.getItem('appliedCoupon');
        const appliedCoupon = appliedCouponJSON ? JSON.parse(appliedCouponJSON) : null;
        const subtotal = itemsForOrder.reduce((s, i) => s + (i.price * i.quantity), 0); 
        
        let deliveryCost = 0;
        if (sessionStorage.getItem('isDigitalCheckout') === 'true') {
            deliveryCost = 10; // Digital flat charge
        } else {
            const location = document.querySelector('input[name="deliveryLocation"]:checked')?.value || 'inside'; 
            deliveryCost = location === 'inside' ? storeSettings.deliveryCosts.inside : storeSettings.deliveryCosts.outside; 
        }
        
        const discount = appliedCoupon ? appliedCoupon.discountAmount : 0; 
        const finalPrice = Math.max(0, subtotal + deliveryCost - discount);

        const orderData = { 
            userId: auth.currentUser.uid, 
            customerInfo: { 
                name: form.elements['delivery-name']?.value || '', 
                phone: form.elements['delivery-phone']?.value || '', 
                address: form.elements['delivery-address']?.value || '' 
            }, 
            items: itemsForOrder, 
            subtotal, deliveryCost, 
            totalPrice: finalPrice, 
            coupon: appliedCoupon ? { code: appliedCoupon.code, discount: appliedCoupon.discountAmount } : null, 
            status: 'Pending', 
            paymentMethod: sessionStorage.getItem('isDigitalCheckout') === 'true' ? 'bKash/Nagad' : 'COD',
            isDigital: sessionStorage.getItem('isDigitalCheckout') === 'true',
            createdAt: serverTimestamp() 
        };

        // Digital product extra info & validation
        if (sessionStorage.getItem('isDigitalCheckout') === 'true') {
            const digitalName = document.getElementById('digital-name')?.value?.trim();
            const digitalWhatsapp = document.getElementById('digital-whatsapp')?.value?.trim();
            const digitalEmail = document.getElementById('digital-email')?.value?.trim();
            const trxId = document.getElementById('transaction-id-input')?.value?.trim();
            const senderNum = document.getElementById('sender-number-input')?.value?.trim();
            const uid = document.getElementById('digital-uid')?.value?.trim();
            const gameName = document.getElementById('digital-game-name')?.value;

            if (!digitalName) { btn.disabled=false; btn.innerHTML='Place Order'; return showToast('নাম দিন!', '#ef4444'); }
            if (!digitalWhatsapp) { btn.disabled=false; btn.innerHTML='Place Order'; return showToast('WhatsApp নম্বর দিন!', '#ef4444'); }
            if (!digitalEmail) { btn.disabled=false; btn.innerHTML='Place Order'; return showToast('Email দিন!', '#ef4444'); }
            if (!trxId) { btn.disabled=false; btn.innerHTML='Place Order'; return showToast('Transaction ID দিন!', '#ef4444'); }
            if (!senderNum) { btn.disabled=false; btn.innerHTML='Place Order'; return showToast('আপনার bKash/Nagad নম্বর দিন!', '#ef4444'); }

            // Update customerInfo for digital
            orderData.customerInfo = { name: digitalName, whatsapp: digitalWhatsapp, email: digitalEmail };
            orderData.paymentInfo = { transactionId: trxId, senderNumber: senderNum, screenshotUrl: paymentSSUrl || null };
            orderData.digitalDeliveryInfo = null;

            // Game UID if needed
            const uidBlock = document.getElementById('game-uid-block');
            if (uidBlock && !uidBlock.classList.contains('hidden')) {
                if (!uid) { btn.disabled=false; btn.innerHTML='Place Order'; return showToast('Game UID দিন!', '#ef4444'); }
                orderData.gameInfo = { uid, gameName: gameName || 'N/A' };
            }
        } else {
            // Physical: validate delivery form — Bengali messages
            const nameVal = document.getElementById('delivery-name')?.value?.trim();
            const phoneVal = document.getElementById('delivery-phone')?.value?.trim();
            const addressVal = document.getElementById('delivery-address')?.value?.trim();
            const phoneRegex = /^01[3-9]\d{8}$/;

            if (!nameVal || nameVal.length < 3) {
                btn.disabled=false; btn.innerHTML='Place Order';
                document.getElementById('delivery-name').focus();
                return showToast('❌ সম্পূর্ণ নাম লিখুন! (কমপক্ষে ৩ অক্ষর)', '#ef4444');
            }
            if (!phoneVal || !phoneRegex.test(phoneVal)) {
                btn.disabled=false; btn.innerHTML='Place Order';
                document.getElementById('delivery-phone').focus();
                return showToast('❌ সঠিক মোবাইল নম্বর দিন! (যেমন: 01XXXXXXXXX)', '#ef4444');
            }
            if (!addressVal || addressVal.length < 10) {
                btn.disabled=false; btn.innerHTML='Place Order';
                document.getElementById('delivery-address').focus();
                return showToast('❌ সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন!', '#ef4444');
            }
        } 

        // নতুন ডকুমেন্টের আইডি আগে থেকে জেনারেট করে নিন
        const orderRef = doc(collection(db, "orders"));
        const orderId = orderRef.id;

        await runTransaction(db, async (transaction) => { 
            transaction.set(orderRef, orderData); 
            if (!buyNowItem) { 
                userCart.forEach(item => transaction.delete(doc(db, `users/${auth.currentUser.uid}/cartItems`, item.id))); 
            } 
        }); 

        showToast('Order placed successfully!');

        form.reset(); 
        clearCheckoutSession();
        showSection('orders'); 
    } catch (error) { 
        showToast(`Failed to place order: ${error.message}`, '#ef4444'); 
        console.error(error);
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = 'Place Order'; 
    } 
});
    
    window.toggleWishlist = async (productId) => { if (!auth.currentUser) return showLoginModal(); const docRef = doc(db, `users/${auth.currentUser.uid}/wishlist`, productId); const isCurrentlyInWishlist = userWishlist.includes(productId); const buttons = document.querySelectorAll(`.wishlist-btn[data-productid="${productId}"]`); buttons.forEach(button => { const icon = button.querySelector('.wishlist-btn-icon'); if (isCurrentlyInWishlist) { icon.classList.add('far'); icon.classList.remove('fas'); button.classList.remove('text-red-500'); if (document.getElementById('product-view-section').contains(button)) button.classList.add('text-gray-500'); else button.classList.add('text-gray-300'); } else { icon.classList.remove('far'); icon.classList.add('fas'); button.classList.add('text-red-500'); button.classList.remove('text-gray-300', 'text-gray-500'); } }); try { if (isCurrentlyInWishlist) { await deleteDoc(docRef); showToast('Removed from wishlist.'); } else { await setDoc(docRef, { productId, addedAt: serverTimestamp() }); showToast('Added to wishlist!'); } } catch(e) { showToast('Action failed. Reverting change.', '#ef4444'); buttons.forEach(button => { const icon = button.querySelector('.wishlist-btn-icon'); if (!isCurrentlyInWishlist) { icon.classList.add('far'); icon.classList.remove('fas'); button.classList.remove('text-red-500'); if (document.getElementById('product-view-section').contains(button)) button.classList.add('text-gray-500'); else button.classList.add('text-gray-300'); } else { icon.classList.remove('far'); icon.classList.add('fas'); button.classList.add('text-red-500'); button.classList.remove('text-gray-300', 'text-gray-500'); } }); } };
    const renderWishlist = async () => { const container = document.getElementById('wishlist-products-container'); if (!auth.currentUser || userWishlist.length === 0) { document.getElementById('wishlist-empty-view').classList.remove('hidden'); container.innerHTML = ''; return; } document.getElementById('wishlist-empty-view').classList.add('hidden'); container.innerHTML = renderSkeletonLoader(6); try { const productDocs = await Promise.all(userWishlist.map(id => getDoc(doc(db, 'products', id)))); const products = productDocs.filter(d => d.exists()).map(d => ({id: d.id, ...d.data()})); container.innerHTML = products.length > 0 ? products.map(p => renderProductCard(p.id, p)).join('') : `<div class="col-span-full text-center py-8"><p>No items currently in stock from your wishlist.</p></div>`; } catch(e) { container.innerHTML = '<p class="text-center text-red-500">Could not load wishlist.</p>'; } };
    
    const listenToOrders = (status = 'all') => { 
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active')); 
        const activeTab = document.querySelector(`.tab-button[data-status="${status}"]`); 
        if (activeTab) activeTab.classList.add('active'); 
        
        const list = document.getElementById('orders-list'), loading = document.getElementById('orders-loading-indicator'), emptyView = document.getElementById('orders-empty-view'); 
        list.innerHTML = ''; 
        loading.classList.remove('hidden'); 
        emptyView.classList.add('hidden'); 
        
        if (!auth.currentUser) { 
            loading.classList.add('hidden'); 
            emptyView.classList.remove('hidden'); 
            return; 
        } 
        
        const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid)); 
        
        ordersUnsubscribe = onSnapshot(q, (snapshot) => { 
            let orders = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            
            if (status === 'Pending') {
                orders = orders.filter(o => ['Pending', 'Processing'].includes(o.status));
            } else if (status === 'Shipped') {
                orders = orders.filter(o => ['Shipped', 'On The Way'].includes(o.status));
            } else if (status === 'Delivered') {
                orders = orders.filter(o => o.status === 'Delivered');
            } else if (status === 'Cancelled') {
                orders = orders.filter(o => ['Cancelled', 'Returned'].includes(o.status));
            }
            
            orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            loading.classList.add('hidden'); 
            emptyView.classList.toggle('hidden', orders.length > 0); 
            list.innerHTML = orders.length > 0 ? orders.map(order => renderOrderCard(order.id, order)).join('') : ''; 
        }, (error) => { 
            console.error(error);
            loading.classList.add('hidden'); 
            list.innerHTML = `<p class="text-red-500 text-center">Could not load orders.</p>`; 
        }); 
    };
    
// --- UPDATED RENDER ORDER CARD (With Return Button Logic) ---
    const renderOrderCard = (id, order) => { 
        const statusColor = { 
            'Pending': 'text-gray-500', 
            'Processing': 'text-blue-500', 
            'Shipped': 'text-purple-500', 
            'On The Way': 'text-purple-600',
            'Delivered': 'text-green-500', 
            'Cancelled': 'text-red-500',
            'Returned': 'text-red-600'
        }; 

        // ৭ দিনের মধ্যে রিটার্ন করা যাবে কিনা চেক করা হচ্ছে
        const canReturnOrder = order.status === 'Delivered' && isReturnable(order.createdAt);
        
        const itemsHtml = order.items.map((item, index) => { 
            let variationText = ''; 
            if (item.variation && typeof item.variation === 'object') { 
                variationText = `<p class="text-xs text-gray-500 mt-1">${Object.values(item.variation).join(', ')}</p>`; 
            }
            
            // রিটার্ন বাটন বা স্ট্যাটাস ব্যাজ দেখানোর লজিক
            let actionHtml = '';
            
            if (item.returnStatus) {
                // যদি আগেই রিটার্ন রিকোয়েস্ট করা থাকে
                const badgeColors = {
                    'Pending': 'bg-yellow-100 text-yellow-800',
                    'Approved': 'bg-blue-100 text-blue-800',
                    'Rejected': 'bg-red-100 text-red-800',
                    'Refunded': 'bg-green-100 text-green-800'
                };
                const colorClass = badgeColors[item.returnStatus] || 'bg-gray-100 text-gray-800';
                actionHtml = `<span class="text-[10px] font-bold px-2 py-1 rounded ${colorClass} mt-2 inline-block">Return: ${item.returnStatus}</span>`;
            } else if (canReturnOrder) {
                // যদি রিটার্ন করার সময় থাকে এবং ডেলিভারড হয়
                actionHtml = `<button onclick="window.openReturnModal('${id}', ${index})" class="mt-2 text-xs border border-primary text-primary-color px-3 py-1 rounded hover:bg-orange-50 font-medium">Return / Replace</button>`;
            } else if (order.status === 'Delivered') {
                // সময় শেষ হয়ে গেলে
                actionHtml = `<span class="text-[10px] text-gray-400 mt-2 inline-block">Return window expired</span>`;
            }

            // ✅ Delivered হলে Write Review button দেখাবে
            if (order.status === 'Delivered') {
                const reviewProductId = item.productId || item.id || '';
                const reviewProductName = (item.name || '').replace(/'/g, "\\'");
                const reviewProductImg = (item.imageUrl || '').replace(/'/g, "\\'");
                if (item.reviewed === true) {
                    actionHtml += `<span class="text-[10px] text-green-600 font-bold mt-1 inline-block"><i class="fas fa-check-circle mr-1"></i>Reviewed</span>`;
                } else {
                    actionHtml += `<button onclick="window.openReviewModal('${reviewProductId}', '${reviewProductName}', '${reviewProductImg}')" class="mt-1 text-xs bg-primary text-white px-3 py-1 rounded font-medium hover:bg-orange-600"><i class="fas fa-pen mr-1"></i>Write Review</button>`;
                }
            }

            return `
            <div class="flex items-start my-2 pb-2 border-b last:border-b-0 border-gray-100">
                <img src="${escapeHtml(item.imageUrl)}" class="w-16 h-16 object-cover rounded mr-3 bg-gray-100" loading="lazy">
                <div class="flex-1">
                    <p class="text-sm text-gray-800 line-clamp-2">${escapeHtml(item.name)}</p>
                    ${variationText}
                    <div class="flex justify-between items-center mt-1">
                        <p class="text-xs text-gray-400">Qty: ${item.quantity}</p>
                        <p class="text-sm font-semibold">৳${item.price}</p>
                    </div>
                    ${actionHtml}
                </div>
            </div>`; 
        }).slice(0, 2).join('');

        const extraItems = order.items.length > 2 
            ? `<p class="text-center text-xs text-gray-500 my-2">+ ${order.items.length - 2} more items</p>` 
            : '';

        return `
        <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div class="flex justify-between items-center text-xs mb-2 pb-2 border-b text-gray-500">
                <span>Order: <strong>#${id.substring(0, 8)}</strong></span>
                <span class="font-bold text-sm ${statusColor[order.status] || 'text-gray-500'}">${order.status}</span>
            </div>
            ${itemsHtml}
            ${extraItems}
            <div class="text-right mt-2 pt-2 border-t flex justify-between items-center">
                 <span class="text-xs text-gray-400">${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : ''}</span>
                 <div class="text-right">
                    <span class="text-xs text-gray-500 block">Total: <span class="text-base font-bold text-primary-color">৳${order.totalPrice.toLocaleString()}</span></span>
                    ${order.isDigital && order.status === 'Delivered' && order.digitalDeliveryInfo ? `<button onclick="window.viewDigitalDelivery('${id}')" class="text-xs bg-green-500 text-white px-3 py-1 rounded font-bold mt-1"><i class="fas fa-download mr-1"></i>ডেলিভারি দেখুন</button>` : ''}
                    ${order.isDigital && order.paymentInfo ? `<span class="text-xs text-blue-500 block mt-1">TrxID: ${order.paymentInfo.transactionId}</span>` : ''}
                    <button class="text-primary-color text-xs font-bold mt-1" onclick="window.showOrderDetails('${id}')">View Details >></button>
                 </div>
            </div>
        </div>`; 
    };
    
    window.showOrderDetails = async (orderId) => { 
        const docSnap = await getDoc(doc(db, "orders", orderId)); 
        if (!docSnap.exists()) return showToast('Order not found!', '#ef4444'); 
        const order = docSnap.data(); 
        const trackingSteps = [
            { status: 'Pending', icon: 'fa-wallet' },
            { status: 'Processing', icon: 'fa-cogs' },
            { status: 'Shipped', icon: 'fa-truck' },
            { status: 'Delivered', icon: 'fa-check-circle' }
        ]; 
        
        let currentStepIndex = -1;
        if(order.status === 'Pending') currentStepIndex = 0;
        else if(order.status === 'Processing') currentStepIndex = 1;
        else if(order.status === 'Shipped' || order.status === 'On The Way') currentStepIndex = 2;
        else if(order.status === 'Delivered') currentStepIndex = 3;

        let trackerHTML = ''; 
        if (order.status !== 'Cancelled' && order.status !== 'Returned') { 
            trackerHTML = `<div class="order-tracker">${trackingSteps.map((step, i) => `<div class="tracker-step ${currentStepIndex >= i ? 'completed' : ''}"><div class="tracker-icon"><i class="fas ${step.icon}"></i></div><span class="tracker-label">${step.status}</span><div class="tracker-line"><div class="tracker-line-progress"></div></div></div>`).join('')}</div>`; 
        } 
        
        let itemsHTML = order.items.map(item => { let variationText = ''; if (item.variation && typeof item.variation === 'object') { variationText = `<br><span class="text-xs text-gray-500">(${Object.entries(item.variation).map(([key, value]) => `${key}: ${value}`).join(', ')})</span>`; } return `<div class="flex items-center text-sm py-2 border-b last:border-b-0"><img src="${escapeHtml(item.imageUrl)}" class="w-12 h-12 rounded object-cover mr-3" loading="lazy"/> <div class="flex-1">${escapeHtml(item.name)}${variationText}<br><span class="text-xs text-gray-500">Qty: ${item.quantity}</span></div> <span>৳${(item.price * item.quantity).toLocaleString()}</span></div>` }).join(''); 
        
        const paymentMethodText = order.paymentMethod === 'COD' ? 'Cash on Delivery' : (order.paymentMethod || 'Cash on Delivery');

        document.getElementById('order-details-content').innerHTML = `<button onclick="window.hideOrderDetailsModal()" class="absolute top-2 right-3 text-2xl text-gray-500 hover:text-gray-800">&times;</button><div class="p-4"><h3 class="font-bold text-lg mb-2">Order Details</h3><p class="text-xs text-gray-500 mb-3">Order #${orderId}</p>${(order.status === 'Cancelled' || order.status === 'Returned') ? `<p class="text-center bg-red-100 text-red-600 font-bold p-2 rounded-lg my-3">This order is ${order.status}.</p>` : trackerHTML}<div class="mt-4"><h4 class="font-semibold mb-2">Items</h4>${itemsHTML}</div><div class="mt-4 bg-gray-50 p-3 rounded"><h4 class="font-semibold mb-2 text-sm">Delivery To</h4><p class="text-xs text-gray-600">${escapeHtml(order.customerInfo.name)}, ${escapeHtml(order.customerInfo.phone)}</p><p class="text-xs text-gray-600">${escapeHtml(order.customerInfo.address)}</p><p class="text-xs text-gray-600 mt-2 font-semibold">Payment: ${paymentMethodText}</p></div></div>`; showOrderDetailsModal(); 
    };
    
    document.getElementById('order-tabs').addEventListener('click', (e) => { if (e.target.matches('.tab-button')) listenToOrders(e.target.dataset.status); });
    document.getElementById('select-address-btn').addEventListener('click', async () => { if (!auth.currentUser) return showLoginModal(); const userDocSnap = await getDoc(doc(db, "users", auth.currentUser.uid)); const addresses = userDocSnap.exists() ? userDocSnap.data().addresses || [] : []; const list = document.getElementById('select-address-list'); list.innerHTML = ''; addresses.forEach(addr => { list.innerHTML += `<div class="address-card cursor-pointer" data-id="${addr.id}"><h4 class="font-semibold text-gray-800">${escapeHtml(addr.label)}</h4><p class="text-sm text-gray-600">${escapeHtml(addr.fullAddress)}</p><p class="text-xs text-gray-500">${escapeHtml(addr.receiverName)}, ${escapeHtml(addr.receiverPhone)}</p></div>`; }); if (addresses.length === 0) list.innerHTML = '<p class="text-center text-gray-500">No saved addresses.</p>'; list.querySelectorAll('.address-card').forEach(card => card.addEventListener('click', () => { list.querySelectorAll('.address-card').forEach(c => c.classList.remove('active-address')); card.classList.add('active-address'); })); showSelectAddressModal(); });
    document.getElementById('confirm-select-address-btn').addEventListener('click', () => { const selected = document.querySelector('#select-address-list .address-card.active-address'); if (selected) { const addrId = selected.dataset.id; getDoc(doc(db, "users", auth.currentUser.uid)).then(snap => { const addr = snap.data().addresses.find(a => a.id === addrId); if (addr) { document.getElementById('delivery-name').value = addr.receiverName; document.getElementById('delivery-phone').value = addr.receiverPhone; document.getElementById('delivery-address').value = addr.fullAddress; hideSelectAddressModal(); showToast('Address selected!'); saveCheckoutFormState(); } }); } else { showToast('Please select an address.', '#ef4444'); } });
    document.getElementById('manage-profile-link').addEventListener('click', (e) => { e.preventDefault(); if (!auth.currentUser) return showLoginModal(); document.getElementById('profile-management-view').classList.add('hidden'); document.getElementById('edit-profile-view').classList.remove('hidden'); }); document.getElementById('back-to-account-btn').addEventListener('click', () => { document.getElementById('profile-management-view').classList.remove('hidden'); document.getElementById('edit-profile-view').classList.add('hidden'); }); document.getElementById('profile-form').addEventListener('submit', async (e) => { e.preventDefault(); if (!auth.currentUser) return; const newName = document.getElementById('profile-name').value, newPhone = document.getElementById('profile-phone').value; try { await updateProfile(auth.currentUser, { displayName: newName }); await updateDoc(doc(db, "users", auth.currentUser.uid), { name: newName, phone: newPhone }); showToast('Profile updated successfully!'); } catch(e) { showToast('Failed to update profile.', '#ef4444'); } });
    const renderAddresses = (addresses = []) => { const list = document.getElementById('address-list'); list.innerHTML = addresses.map(addr => `<div class="address-card" data-id="${addr.id}"><h4 class="font-semibold text-gray-800">${escapeHtml(addr.label)}</h4><p class="text-sm text-gray-600">${escapeHtml(addr.fullAddress)}</p><p class="text-xs text-gray-500">${escapeHtml(addr.receiverName)}, ${escapeHtml(addr.receiverPhone)}</p><div class="absolute top-2 right-2 space-x-2"><button class="text-primary-color text-sm edit-address-btn" data-id="${addr.id}">Edit</button><button class="text-red-500 text-sm delete-address-btn" data-id="${addr.id}">Delete</button></div></div>`).join(''); };
    document.getElementById('address-list').addEventListener('click', async (e) => { if (!auth.currentUser) return; const target = e.target, userDocRef = doc(db, "users", auth.currentUser.uid); if (target.classList.contains('edit-address-btn')) { const addrId = target.dataset.id, userDocSnap = await getDoc(userDocRef), address = userDocSnap.data().addresses.find(a => a.id === addrId); document.getElementById('address-id').value = addrId; document.getElementById('address-label').value = address.label; document.getElementById('address-receiver-name').value = address.receiverName; document.getElementById('address-receiver-phone').value = address.receiverPhone; document.getElementById('address-full-address').value = address.fullAddress; document.getElementById('address-modal-title').textContent = 'Edit Address'; showAddressModal(); } else if (target.classList.contains('delete-address-btn')) { const addrId = target.dataset.id; if (confirm('Are you sure?')) try { const userDocSnap = await getDoc(userDocRef), addresses = userDocSnap.data().addresses.filter(a => a.id !== addrId); await updateDoc(userDocRef, { addresses }); showToast('Address deleted!'); } catch(e) { showToast('Failed to delete address.', '#ef4444'); } } });
    document.getElementById('address-form').addEventListener('submit', async (e) => { e.preventDefault(); if (!auth.currentUser) return; const userDocRef = doc(db, "users", auth.currentUser.uid); let addressId = document.getElementById('address-id').value; const isEditing = !!addressId; if (!isEditing) addressId = Date.now().toString(); const newAddress = { id: addressId, label: document.getElementById('address-label').value, receiverName: document.getElementById('address-receiver-name').value, receiverPhone: document.getElementById('address-receiver-phone').value, fullAddress: document.getElementById('address-full-address').value, }; try { const userDocSnap = await getDoc(userDocRef); let addresses = userDocSnap.exists() ? userDocSnap.data().addresses || [] : []; const existingIndex = addresses.findIndex(a => a.id === addressId); if (existingIndex > -1) { addresses[existingIndex] = newAddress; showToast('Address updated!'); } else { addresses.push(newAddress); showToast('Address added!'); } await setDoc(userDocRef, { addresses }, { merge: true }); hideAddressModal(); } catch(e) { showToast(`Failed to save address: ${e.message}`, '#ef4444'); } });
    const renderSupportLinks = (links = {}) => { const container = document.getElementById('support-links-container'); const linkData = [ { key: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: '#25D366', text: 'Chat with us directly' }, { key: 'facebook', name: 'Facebook', icon: 'fab fa-facebook-messenger', color: '#00B2FF', text: 'Message our page' }, { key: 'instagram', name: 'Instagram', icon: 'fab fa-instagram', color: '#E4405F', text: 'Follow us for updates' }, { key: 'telegram', name: 'Telegram', icon: 'fab fa-telegram-plane', color: '#229ED9', text: 'Join our community' }, { key: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: '#FF0000', text: 'Watch our videos' }, { key: 'mediafire', name: 'Download Our App', icon: 'fas fa-mobile-alt', color: '#1175E8', text: 'Get the full experience' }, ]; let html = linkData.map(link => (links[link.key] ? `<a href="${escapeHtml(links[link.key])}" target="_blank" class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"><i class="${link.icon} text-3xl" style="color: ${link.color};"></i><div><p class="font-semibold text-gray-800">${link.name}</p><p class="text-xs text-gray-500">${link.text}</p></div></a>` : '')).join(''); container.innerHTML = html || '<p class="text-center text-gray-500">Support links will be available soon.</p>'; };
    const renderAboutUs = (about = {}) => { const container = document.getElementById('about-us-content'); if (about && about.content) { const formattedContent = about.content.split('\n').map(p => `<p>${escapeHtml(p)}</p>`).join(''); container.innerHTML = `<h2 class="text-2xl font-bold mb-4">${escapeHtml(about.title || 'About Us')}</h2><div class="prose max-w-none text-gray-600 space-y-4">${formattedContent}</div>`; } else { container.innerHTML = '<p class="text-center text-gray-500 py-16">Information about us is coming soon!</p>'; } };
    
    // Home countdown timer — onSnapshot দিয়ে real-time Firebase sync
    let homeCountdownInterval = null;

    const startCountdown = () => {
        const timerEl = document.getElementById('countdown-timer');
        if (!timerEl) return;

        const showZero = () => {
            timerEl.innerHTML = '<span class="bg-gray-800 text-white font-bold w-6 h-6 flex items-center justify-center rounded">00</span>:<span class="bg-gray-800 text-white font-bold w-6 h-6 flex items-center justify-center rounded">00</span>:<span class="bg-gray-800 text-white font-bold w-6 h-6 flex items-center justify-center rounded">00</span>';
            if (homeCountdownInterval) { clearInterval(homeCountdownInterval); homeCountdownInterval = null; }
        };

        // Real-time Firebase listener — admin ON/OFF করলে সাথে সাথে update হবে
        onSnapshot(doc(db, 'settings', 'flashSale'), (fsDoc) => {
            if (homeCountdownInterval) { clearInterval(homeCountdownInterval); homeCountdownInterval = null; }

            if (!fsDoc.exists()) { showZero(); return; }

            const d = fsDoc.data();
            const isActive = d.active === true || d.active === 'true';

            let targetTime = 0;
            if (d.endTime) {
                if (typeof d.endTime.toMillis === 'function') {
                    targetTime = d.endTime.toMillis();
                } else if (typeof d.endTime === 'number') {
                    targetTime = d.endTime;
                }
            }

            const isExpired = targetTime > 0 && targetTime < Date.now();

            if (!isActive || isExpired || !targetTime) { showZero(); return; }

            // Timer চালু — DD:HH:MM:SS format
            const box = (val, label='') => `<span class="bg-gray-800 text-white font-bold px-1.5 h-6 flex items-center justify-center rounded text-xs">${val}${label}</span>`;
            const updateTimer = () => {
                const diff = Math.floor((targetTime - Date.now()) / 1000);
                if (diff <= 0) { showZero(); return; }
                const days = Math.floor(diff / 86400);
                const h = String(Math.floor((diff % 86400) / 3600)).padStart(2, '0');
                const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
                const s = String(diff % 60).padStart(2, '0');
                if (days > 0) {
                    timerEl.innerHTML = `${box(days+'d')}${box(h)}:${box(m)}:${box(s)}`;
                } else {
                    timerEl.innerHTML = `${box(h)}:${box(m)}:${box(s)}`;
                }
            };
            updateTimer();
            homeCountdownInterval = setInterval(updateTimer, 1000);
        });
    };

    // ── Flash Sale Page ──────────────────────────────────────────────
    let fsCountdownInterval = null;

    const startFlashSaleCountdown = (endTime) => {
        const timerEl = document.getElementById('fs-countdown-timer');
        const statusEl = document.getElementById('fs-status-badge');
        if (!timerEl) return;
        if (fsCountdownInterval) clearInterval(fsCountdownInterval);

        const fsBox = (val) => `<span class="bg-white text-red-600 font-bold px-1.5 h-7 flex items-center justify-center rounded text-xs">${val}</span>`;
        const update = () => {
            const now = Date.now();
            let diff = Math.floor((endTime - now) / 1000);
            if (diff <= 0) {
                timerEl.innerHTML = `${fsBox('00')}:${fsBox('00')}:${fsBox('00')}`;
                if (statusEl) statusEl.textContent = 'ENDED';
                clearInterval(fsCountdownInterval);
                return;
            }
            const days = Math.floor(diff / 86400);
            const h = String(Math.floor((diff % 86400) / 3600)).padStart(2, '0');
            const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
            const s = String(diff % 60).padStart(2, '0');
            if (days > 0) {
                timerEl.innerHTML = `${fsBox(days+'d')}${fsBox(h)}:${fsBox(m)}:${fsBox(s)}`;
            } else {
                timerEl.innerHTML = `${fsBox(h)}:${fsBox(m)}:${fsBox(s)}`;
            }
            if (statusEl) statusEl.textContent = 'LIVE';
        };
        update();
        fsCountdownInterval = setInterval(update, 1000);
    };

    const renderFlashSalePage = async () => {
        const container = document.getElementById('flash-sale-products-container');
        const loading = document.getElementById('flash-sale-loading');
        const empty = document.getElementById('no-flash-sale-products');
        container.innerHTML = '';
        empty.classList.add('hidden');
        loading.innerHTML = renderSkeletonLoader(4);

        try {
            const fsDoc = await getDoc(doc(db, 'settings', 'flashSale'));
            
            // Helper: timer কে 00:00:00 এ reset করো
            const resetFSTimer = () => {
                const timerEl = document.getElementById('fs-countdown-timer');
                const statusEl = document.getElementById('fs-status-badge');
                if (timerEl) timerEl.innerHTML = '<span class="bg-white text-red-600 font-bold w-7 h-7 flex items-center justify-center rounded text-xs">00</span>:<span class="bg-white text-red-600 font-bold w-7 h-7 flex items-center justify-center rounded text-xs">00</span>:<span class="bg-white text-red-600 font-bold w-7 h-7 flex items-center justify-center rounded text-xs">00</span>';
                if (statusEl) statusEl.textContent = 'ENDED';
                if (fsCountdownInterval) { clearInterval(fsCountdownInterval); fsCountdownInterval = null; }
            };

            if (!fsDoc.exists()) {
                resetFSTimer();
                loading.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }

            const fsData = fsDoc.data();
            // active boolean true বা string "true" দুটোই handle করো
            const isActive = fsData.active === true || fsData.active === 'true';

            // endTime — Firestore Timestamp বা number দুটোই handle করো
            let endTime = 0;
            if (fsData.endTime) {
                if (typeof fsData.endTime.toMillis === 'function') {
                    endTime = fsData.endTime.toMillis();
                } else if (typeof fsData.endTime === 'number') {
                    endTime = fsData.endTime;
                }
            }

            const isExpired = endTime > 0 && endTime < Date.now();

            if (!isActive || isExpired) {
                resetFSTimer();
                loading.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }

            // Timer চালু করো
            startFlashSaleCountdown(endTime || Date.now() + 3600000);

            // Home এর countdown timer ও same endTime দিয়ে চালু করো
            localStorage.setItem('flashSaleEndTime', String(endTime));

            const productIds = fsData.productIds || [];
            if (productIds.length === 0) {
                loading.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }

            const productPromises = productIds.slice(0, 50).map(pid => getDoc(doc(db, 'products', pid)));
            const snaps = await Promise.all(productPromises);
            const products = snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() }));

            loading.innerHTML = '';
            if (products.length === 0) {
                empty.classList.remove('hidden');
                return;
            }
            container.innerHTML = products.map(p => renderProductCard(p.id, p)).join('');

        } catch (err) {
            console.error('Flash sale page error:', err);
            loading.innerHTML = '<p class="text-center text-red-400 py-10">লোড করা যায়নি।</p>';
        }
    };

    // ── Official Portal ──────────────────────────────────────────────
    window.openOfficialPortal = async () => {
        try {
            const docSnap = await getDoc(doc(db, 'settings', 'siteConfig'));
            if (docSnap.exists()) {
                const url = docSnap.data()?.storeSettings?.portalUrl || docSnap.data()?.portalUrl;
                if (url) { window.open(url, '_blank'); return; }
            }
        } catch(e) {}
        showToast('Portal link set করা হয়নি।', '#ef4444');
    };

    // Load portal option visibility from settings
    const loadPortalOption = async () => {
        try {
            const docSnap = await getDoc(doc(db, 'settings', 'siteConfig'));
            if (docSnap.exists()) {
                const url = docSnap.data()?.storeSettings?.portalUrl || docSnap.data()?.portalUrl;
                const el = document.getElementById('official-portal-option');
                if (el) {
                    if (url) {
                        el.classList.remove('hidden');
                        el.style.display = 'flex';
                    } else {
                        el.classList.add('hidden');
                        el.style.display = 'none';
                    }
                }
            }
        } catch(e) {}
    };
    loadPortalOption();
    
    const ptrSpinner = document.getElementById('pull-to-refresh-spinner'); const contentArea = document.querySelector('main.content-area'); let startY = 0, isRefreshing = false;
    
    const handleRefresh = async () => { 
        const activeSection = document.querySelector('.section.active-section'); 
        if (!activeSection) return; 
        const sectionId = activeSection.id.replace('-section', ''); 
        switch(sectionId) { 
            case 'home': 
                await fetchProducts(true); 
                listenToSliders(); 
                listenToOffers();
                listenToCampaigns();
                break; 
            case 'orders': 
                const activeTab = document.querySelector('.tab-button.active'); 
                listenToOrders(activeTab ? activeTab.dataset.status : 'all'); 
                break; 
            case 'wishlist': 
                await renderWishlist(); 
                break; 
            case 'cart':
                renderCart();
                break;
        } 
    };
// --- RETURN SYSTEM LOGIC (Paste inside module) ---

    // 1. Check if returnable (7 days check)
    const isReturnable = (orderDateTimestamp) => {
        if (!orderDateTimestamp) return false;
        const orderDate = orderDateTimestamp.toDate ? orderDateTimestamp.toDate() : new Date(orderDateTimestamp.seconds * 1000);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return orderDate > sevenDaysAgo;
    };

    // 2. Open Modal Logic
    window.openReturnModal = (orderId, itemIndex) => {
        const modal = document.getElementById('return-modal');
        // Fetch order details simply to ensure fresh data
        getDoc(doc(db, "orders", orderId)).then(docSnap => {
            if(!docSnap.exists()) return;
            const order = docSnap.data();
            const item = order.items[itemIndex];

            // Reset Form
            document.getElementById('return-form').reset();
            returnImages = [];
            document.getElementById('return-image-preview-container').innerHTML = `
                <label for="return-image-input" id="return-upload-btn" class="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 transition-colors">
                    <i class="fas fa-camera text-gray-400 text-lg"></i>
                    <span class="text-[10px] text-gray-400 mt-1">Add Photo</span>
                </label>`;
            document.getElementById('return-upload-btn').style.display = 'flex';

            // Fill Data
            document.getElementById('return-order-id').textContent = orderId;
            document.getElementById('return-order-id').dataset.fullId = orderId;
            document.getElementById('return-product-id').value = item.productId || item.id;
            document.getElementById('return-item-variation').value = JSON.stringify(item.variation || {});
            
            document.getElementById('return-product-img').src = item.imageUrl;
            document.getElementById('return-product-name').textContent = item.name;
            document.getElementById('return-product-price').textContent = `Qty: ${item.quantity} | ৳${item.price}`;

            modal.classList.add('active');
            modal.dataset.itemIndex = itemIndex; // Save index
        });
    };

    // 3. Image Upload (Auto ImgBB)
    document.getElementById('return-image-input').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (returnImages.length + files.length > 5) {
            showToast("Max 5 images allowed.", "#ef4444");
            return;
        }

        const previewContainer = document.getElementById('return-image-preview-container');
        const uploadBtn = document.getElementById('return-upload-btn');
        const toast = Toastify({ text: "Uploading...", duration: -1, style: { background: "#3b82f6" } }).showToast();

        for (const file of files) {
            const formData = new FormData();
            formData.append("image", file);
            try {
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
                const data = await res.json();
                if (data.success) {
                    const url = data.data.url;
                    returnImages.push(url);
                    const div = document.createElement('div');
                    div.className = "w-20 h-20 relative rounded overflow-hidden border border-gray-200";
                    div.innerHTML = `<img src="${url}" class="w-full h-full object-cover"><button type="button" onclick="window.removeReturnImage('${url}', this)" class="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs">&times;</button>`;
                    previewContainer.insertBefore(div, uploadBtn);
                }
            } catch (error) { console.error(error); showToast("Upload failed.", "#ef4444"); }
        }
        toast.hideToast();
        if (returnImages.length >= 5) uploadBtn.style.display = 'none';
    });

    window.removeReturnImage = (url, btnElement) => {
        returnImages = returnImages.filter(img => img !== url);
        btnElement.parentElement.remove();
        document.getElementById('return-upload-btn').style.display = 'flex';
    };

    // 4. Submit Logic (UPDATED WITH ITEM INDEX)
    document.getElementById('return-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (returnImages.length === 0) return showToast("Please upload proof.", "#ef4444");
        
        const submitBtn = document.getElementById('submit-return-btn');
        submitBtn.disabled = true; 
        submitBtn.textContent = 'Processing...';

        try {
            const orderId = document.getElementById('return-order-id').dataset.fullId;
            // এই itemIndex আমরা মোডাল ওপেন করার সময় সেট করেছিলাম
            const itemIndex = parseInt(document.getElementById('return-modal').dataset.itemIndex);
            
            // User-এর extra info আনা
            let userPhone = '', userAddress = '';
            try {
                const uSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (uSnap.exists()) {
                    userPhone = uSnap.data().phone || '';
                    const addrs = uSnap.data().addresses || [];
                    const def = addrs.find(a => a.isDefault) || addrs[0];
                    if (def) userAddress = ((def.address || '') + ' ' + (def.area || '')).trim();
                }
            } catch(e) {}

            const returnData = {
                orderId: orderId,
                productId: document.getElementById('return-product-id').value,
                itemIndex: itemIndex,
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || 'User',
                userEmail: auth.currentUser.email || '',
                userPhone: userPhone,
                userAddress: userAddress,
                reason: document.getElementById('return-reason').value,
                description: document.getElementById('return-description').value,
                images: returnImages,
                status: 'Pending',
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, "returnRequests"), returnData);

            // Update Order Item Status locally in DB
            await runTransaction(db, async (transaction) => {
                const orderRef = doc(db, "orders", orderId);
                const orderDoc = await transaction.get(orderRef);
                if (orderDoc.exists()) {
                    const items = orderDoc.data().items;
                    // ইনডেক্স দিয়ে আপডেট করা হচ্ছে যা ১০০% সঠিক হবে
                    if(items[itemIndex]) {
                        items[itemIndex].returnStatus = "Pending";
                        transaction.update(orderRef, { items: items });
                    }
                }
            });

            showToast("Request submitted!");
            document.getElementById('return-modal').classList.remove('active');
        } catch (error) { 
            console.error(error);
            showToast("Error: " + error.message, "#ef4444"); 
        } 
        finally { submitBtn.disabled = false; submitBtn.textContent = 'Submit Request'; }
    });
    
    
    document.getElementById('close-return-modal-btn').addEventListener('click', () => {
        document.getElementById('return-modal').classList.remove('active');
    });
    
    contentArea.addEventListener('touchstart', (e) => { if (window.scrollY === 0) startY = e.touches[0].pageY; }, { passive: true });
    contentArea.addEventListener('touchmove', (e) => { const currentY = e.touches[0].pageY; if (window.scrollY === 0 && currentY > startY && !isRefreshing) { const diff = currentY - startY; if (diff > 80) { ptrSpinner.classList.add('visible'); ptrSpinner.style.transform = 'translateX(-50%) scale(1) rotate(180deg)'; } else { ptrSpinner.style.transform = `translateX(-50%) scale(${diff / 100}) rotate(${diff * 2}deg)`; ptrSpinner.classList.add('visible'); } } }, { passive: true });
    contentArea.addEventListener('touchend', async (e) => { const currentY = e.changedTouches[0].pageY; if (window.scrollY === 0 && currentY > startY && !isRefreshing) { const diff = currentY - startY; if (diff > 80) { isRefreshing = true; ptrSpinner.style.transition = 'transform 0.3s'; ptrSpinner.style.transform = 'translateX(-50%) scale(1)'; ptrSpinner.querySelector('.loading-spinner').style.animation = 'spin 1s linear infinite'; await handleRefresh(); setTimeout(() => { ptrSpinner.classList.remove('visible'); isRefreshing = false; }, 500); } else { ptrSpinner.classList.remove('visible'); } } else { ptrSpinner.classList.remove('visible'); } });

    let isAppInitialized = false;
 



// =============================================
// DIGITAL PRODUCT SYSTEM
// =============================================

window.copyToClipboard = (elementId) => {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => showToast('Copied!', '#10b981'));
};

window.copyDeliveryInfo = () => {
    const text = document.getElementById('digital-delivery-content').textContent;
    navigator.clipboard.writeText(text).then(() => showToast('Copied!', '#10b981'));
};

const loadPaymentNumbers = async () => {
    try {
        const docSnap = await getDoc(doc(db, "settings", "siteConfig"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const bkash = data?.paymentNumbers?.bkash || 'সেট করা হয়নি';
            const nagad = data?.paymentNumbers?.nagad || 'সেট করা হয়নি';
            const b = document.getElementById('bkash-number-display');
            const n = document.getElementById('nagad-number-display');
            if (b) b.textContent = bkash;
            if (n) n.textContent = nagad;
        }
    } catch(e) { console.error(e); }
};

// Detect if current checkout is digital
const getIsDigital = () => sessionStorage.getItem('isDigitalCheckout') === 'true';

// Detect if product needs Game UID (FF Diamond, PUBG etc.)
const needsGameUID = () => {
    const buyNowItem = sessionStorage.getItem('buyNowItem');
    if (buyNowItem) {
        const item = JSON.parse(buyNowItem);
        const product = allProducts.find(p => p.id === item.productId);
        return product?.needsUID === true;
    }
    // Check cart
    return userCart.some(item => {
        const product = allProducts.find(p => p.id === item.productId);
        return product?.needsUID === true;
    });
};

// Toggle checkout UI based on product type
const updateCheckoutForDigital = () => {
    const isDigital = getIsDigital();
    const physicalBlock = document.getElementById('physical-checkout-block');
    const digitalBlock = document.getElementById('digital-checkout-block');
    const gameUidBlock = document.getElementById('game-uid-block');
    const paymentDisplay = document.getElementById('payment-method-display');
    const deliveryCostRow = document.getElementById('delivery-cost-row');
    const couponSection = document.getElementById('coupon-section');
    const placeOrderBtn = document.getElementById('place-order-btn');
    // Order summary div (parent of checkout-subtotal)
    const orderSummaryDiv = document.getElementById('checkout-subtotal')?.closest('.bg-white.rounded.p-4.shadow-sm');

    if (isDigital) {
        physicalBlock?.classList.add('hidden');
        digitalBlock?.classList.remove('hidden');
        // Hide coupon, order summary, place order for digital
        couponSection?.classList.add('hidden');
        if (orderSummaryDiv) orderSummaryDiv.classList.add('hidden');
        if (placeOrderBtn) placeOrderBtn.classList.add('hidden');
        if (needsGameUID()) {
            gameUidBlock?.classList.remove('hidden');
        } else {
            gameUidBlock?.classList.add('hidden');
        }
        if (paymentDisplay) paymentDisplay.innerHTML = `
            <p class="text-sm text-gray-600 flex items-center mt-1">
                <i class="fas fa-mobile-alt text-pink-500 mr-2"></i> bKash / Nagad
            </p>`;
        loadPaymentNumbers();
        // Reset to step 1 whenever digital checkout is shown
        if (typeof resetDigitalSteps === 'function') resetDigitalSteps();
    } else {
        physicalBlock?.classList.remove('hidden');
        digitalBlock?.classList.add('hidden');
        // Show coupon, order summary, place order for physical
        couponSection?.classList.remove('hidden');
        if (orderSummaryDiv) orderSummaryDiv.classList.remove('hidden');
        if (placeOrderBtn) placeOrderBtn.classList.remove('hidden');
        gameUidBlock?.classList.add('hidden');
        if (paymentDisplay) paymentDisplay.innerHTML = `
            <p class="text-sm text-gray-600 flex items-center mt-1">
                <i class="fas fa-money-bill-wave text-green-500 mr-2"></i> Cash on Delivery
            </p>`;
    }
};

const checkDigitalDelivery = async (orderId) => {
    try {
        const orderSnap = await getDoc(doc(db, "orders", orderId));
        if (!orderSnap.exists()) return;
        const order = orderSnap.data();
        if (order.isDigital && order.digitalDeliveryInfo && order.status === 'Delivered') {
            document.getElementById('digital-delivery-content').textContent = order.digitalDeliveryInfo;
            document.getElementById('digital-delivery-modal').classList.add('active');
        }
    } catch(e) { console.error(e); }
};

window.viewDigitalDelivery = checkDigitalDelivery;

// =============================================
// END DIGITAL PRODUCT SYSTEM
// =============================================

// =============================================
// DIGITAL CHECKOUT STEP NAVIGATION
// =============================================

let paymentSSUrl = '';

const goToDigitalStep = (step) => {
    document.getElementById('digital-step-1').classList.toggle('hidden', step !== 1);
    document.getElementById('digital-step-2').classList.toggle('hidden', step !== 2);
    document.getElementById('digital-step-3').classList.toggle('hidden', step !== 3);

    // Update step indicators
    const steps = [1, 2, 3];
    steps.forEach(s => {
        const circle = document.getElementById(`dstep-${s}-circle`);
        const label = document.getElementById(`dstep-${s}-label`);
        if (!circle || !label) return;
        if (s < step) {
            circle.className = 'w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold';
            circle.innerHTML = '<i class="fas fa-check text-xs"></i>';
        } else if (s === step) {
            circle.className = 'w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold';
            circle.textContent = s;
            label.className = 'text-[10px] font-semibold text-primary-color';
        } else {
            circle.className = 'w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-sm font-bold';
            circle.textContent = s;
            label.className = 'text-[10px] font-semibold text-gray-400';
        }
    });

    // Update step lines
    const line1 = document.getElementById('dstep-line-1');
    const line2 = document.getElementById('dstep-line-2');
    if (line1) line1.className = step >= 2 ? 'flex-1 h-0.5 bg-primary' : 'flex-1 h-0.5 bg-gray-200';
    if (line2) line2.className = step >= 3 ? 'flex-1 h-0.5 bg-primary' : 'flex-1 h-0.5 bg-gray-200';

    window.scrollTo(0, 200);
};

// Step 1 → Step 2
document.getElementById('digital-next-step1')?.addEventListener('click', () => {
    const name = document.getElementById('digital-name')?.value?.trim();
    const wa = document.getElementById('digital-whatsapp')?.value?.trim();
    const email = document.getElementById('digital-email')?.value?.trim();
    if (!name) return showToast('নাম দিন!', '#ef4444');
    if (!wa) return showToast('WhatsApp নম্বর দিন!', '#ef4444');
    if (!email || !email.includes('@')) return showToast('সঠিক Email দিন!', '#ef4444');

    // Update payment amount display
    const total = document.getElementById('checkout-total')?.textContent || '৳0';
    const amtEl = document.getElementById('digital-payment-amount-display');
    if (amtEl) amtEl.textContent = total;

    goToDigitalStep(2);
});

// Step 2 → Step 1
document.getElementById('digital-prev-step2')?.addEventListener('click', () => goToDigitalStep(1));

// Step 2 → Step 3
document.getElementById('digital-next-step2')?.addEventListener('click', () => {
    const trxId = document.getElementById('transaction-id-input')?.value?.trim();
    const senderNum = document.getElementById('sender-number-input')?.value?.trim();
    if (!trxId) return showToast('Transaction ID দিন!', '#ef4444');
    if (!senderNum) return showToast('আপনার bKash/Nagad নম্বর দিন!', '#ef4444');
    if (!paymentSSUrl) return showToast('Payment Screenshot আপলোড করুন!', '#ef4444');

    // Fill confirm summary
    document.getElementById('confirm-name-display').textContent = document.getElementById('digital-name')?.value || '';
    document.getElementById('confirm-whatsapp-display').textContent = '+880 ' + (document.getElementById('digital-whatsapp')?.value || '');
    document.getElementById('confirm-email-display').textContent = document.getElementById('digital-email')?.value || '';
    document.getElementById('confirm-trxid-display').textContent = 'TrxID: ' + trxId;
    document.getElementById('confirm-sender-display').textContent = 'From: ' + senderNum;

    const confirmSSContainer = document.getElementById('confirm-ss-container');
    const confirmSSImg = document.getElementById('confirm-ss-img');
    if (paymentSSUrl && confirmSSImg) {
        confirmSSImg.src = paymentSSUrl;
        confirmSSContainer?.classList.remove('hidden');
    }

    goToDigitalStep(3);
});

// Step 3 → Step 2
document.getElementById('digital-prev-step3')?.addEventListener('click', () => goToDigitalStep(2));

// Digital Place Order Button (Step 3) → triggers main place-order-btn
document.getElementById('digital-place-order-btn')?.addEventListener('click', () => {
    document.getElementById('place-order-btn')?.click();
});

// Payment Screenshot Upload
document.getElementById('payment-ss-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const previewArea = document.getElementById('payment-ss-preview-area');
    const previewImg = document.getElementById('payment-ss-preview-img');
    const uploadingText = document.getElementById('payment-ss-uploading');
    const successText = document.getElementById('payment-ss-success');
    const uploadBtn = document.getElementById('payment-ss-upload-btn');

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    previewImg.src = localUrl;
    previewArea.classList.remove('hidden');
    uploadBtn.classList.add('hidden');
    uploadingText.classList.remove('hidden');
    if (successText) successText.classList.add('hidden');
    paymentSSUrl = '';
    document.getElementById('payment-ss-url').value = '';

    try {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            paymentSSUrl = data.data.url;
            document.getElementById('payment-ss-url').value = paymentSSUrl;
            uploadingText.classList.add('hidden');
            if (successText) successText.classList.remove('hidden');
        } else {
            throw new Error('Upload failed');
        }
    } catch (err) {
        showToast('Screenshot আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।', '#ef4444');
        previewArea.classList.add('hidden');
        uploadBtn.classList.remove('hidden');
        uploadingText.classList.add('hidden');
        paymentSSUrl = '';
    }
});

window.removePaymentSS = () => {
    paymentSSUrl = '';
    document.getElementById('payment-ss-url').value = '';
    document.getElementById('payment-ss-preview-area').classList.add('hidden');
    document.getElementById('payment-ss-upload-btn').classList.remove('hidden');
    document.getElementById('payment-ss-input').value = '';
};

// Reset digital steps when checkout re-renders
const resetDigitalSteps = () => {
    paymentSSUrl = '';
    goToDigitalStep(1);
};

// END DIGITAL CHECKOUT STEPS
// =============================================

    onAuthStateChanged(auth, (user) => {
    initializeUserDependentState(user);
    // Background notification listener
    if (user) {
        if (notifBgUnsubscribe) notifBgUnsubscribe();
        notifBgUnsubscribe = startNotificationListener();
    } else {
        if (notifBgUnsubscribe) { notifBgUnsubscribe(); notifBgUnsubscribe = null; }
        document.getElementById('notification-dot').classList.add('hidden');
    }
    if (!isAppInitialized) {
        isAppInitialized = true;
        
        const loader = document.getElementById('app-loader');
        if(loader) loader.style.display = 'none';

        // --- পরিবর্তন শুরু: হ্যাশ এর বদলে পাথ (Clean URL) রিড করা ---
        const path = window.location.pathname.split('/').filter(p => p); 
        const sectionId = path[0] || 'home';
        const param = path[1] || null;

        const initialState = { sectionId, param }; 
        // ইতিহাস ঠিক রাখা
        history.replaceState(initialState, '', window.location.pathname); 
        
        renderPage(initialState);
        // --- পরিবর্তন শেষ ---
    }
});
document.getElementById('sort-btn').addEventListener('click', () => {
    const currentSort = localStorage.getItem('searchSort') === 'price_asc' ? 'price_desc' : 'price_asc';
    localStorage.setItem('searchSort', currentSort);
    showToast(`Sorting by price: ${currentSort === 'price_asc' ? 'Low to High' : 'High to Low'}`);
    renderSearchPage(currentSearchQuery, currentSort);
});

// ══════════════════════════════════════
// OFFLINE DETECTION SYSTEM
// ══════════════════════════════════════
const offlineOverlay = document.getElementById('offline-overlay');

const showOfflinePage = () => {
    const logoSrc = document.getElementById('store-logo')?.src;
    const storeName = storeSettings?.storeName || 'Chilmari E-Shop';
    if (logoSrc) document.getElementById('offline-logo-img').src = logoSrc;
    document.getElementById('offline-store-name').textContent = storeName;
    offlineOverlay.classList.add('active');
};

const hideOfflinePage = () => {
    offlineOverlay.classList.remove('active');
    showToast('✅ ইন্টারনেট সংযোগ ফিরে এসেছে!', '#10b981');
};

if (!navigator.onLine) showOfflinePage();
window.addEventListener('offline', showOfflinePage);
window.addEventListener('online', hideOfflinePage);

window.handleOfflineRetry = () => {
    const btn = document.getElementById('offlineRetryBtn');
    btn.classList.add('loading');
    setTimeout(() => {
        btn.classList.remove('loading');
        if (navigator.onLine) {
            hideOfflinePage();
        } else {
            showToast('এখনও ইন্টারনেট নেই। আবার চেষ্টা করুন।', '#ef4444');
        }
    }, 1500);
};
// END OFFLINE DETECTION
