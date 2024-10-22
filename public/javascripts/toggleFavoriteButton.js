/* 
    This script is used to toggle the favorite button on the location page. 
    It sends a POST request to the server to add or remove the location from the user's favorites. 
*/
document.addEventListener("DOMContentLoaded", function () {
  const favoriteForm = document.getElementById("favoriteForm");

  if (favoriteForm) {
    favoriteForm.addEventListener("submit", function (event) {
      event.preventDefault(); // Prevent the form from submitting the default way

      const formData = new FormData(favoriteForm); // Get the form data using FormData API (https://developer.mozilla.org/en-US/docs/Web/API/FormData)
      const location = formData.get("location");
      const action = favoriteForm.getAttribute("action"); // Determine if it's an add or remove action
      console.log("Button Submission, action:", action);

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
            window.location.href = `/search?location=${encodeURIComponent(
              location
            )}`; // Redirect to the search page
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
