/* 
    This script is used to toggle the favorite button on the location page. 
    It sends a POST request to the server to add or remove the location from the user's favorites. 
*/
document.addEventListener("DOMContentLoaded", function () {
  const favoriteForm = document.getElementById("favoriteForm");
  console.log("Favorite Form:", favoriteForm);
  const favoriteBtn = document.getElementById("favoriteBtn");

  if (favoriteForm) {
    favoriteForm.addEventListener("submit", function (event) {
      event.preventDefault(); // Prevent the form from submitting the default way

      const formData = new FormData(favoriteForm);
      const location = formData.get("location");
      console.log("Location from form data:", location);
      const action = favoriteForm.getAttribute("action"); // Determine if it's an add or remove action

      fetch(action, {
        method: "POST",
        body: JSON.stringify({ location }),
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((response) => {
          if (response.ok) {
            // After successful add/remove, reload the page to reflect changes
            console.log("Favorite added/removed successfully");
            window.location.href = `/search?location=${encodeURIComponent(location)}`;
          } else {
            return response.json().then((errorData) => {
              alert(`Error: ${errorData.message}`);
            });
          }
        })
        .catch((error) => {
          console.error("Network Error:", error);
          alert("A network error occurred. Please try again later.");
        });
    });
  }
});
