const searchInput = document.querySelector("#game-search");
const filterButtons = document.querySelectorAll(".filter");
const gameCards = document.querySelectorAll(".game-card");
const emptyState = document.querySelector(".empty-state");
let activeFilter = "all";

function updateCatalog() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    gameCards.forEach((card) => {
        const matchesFilter = activeFilter === "all" || card.dataset.category === activeFilter;
        const matchesSearch = card.dataset.search.includes(query);
        const isVisible = matchesFilter && matchesSearch;

        card.hidden = !isVisible;
        if (isVisible) {
            visibleCount += 1;
        }
    });

    emptyState.hidden = visibleCount !== 0;
}

searchInput.addEventListener("input", updateCatalog);

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        filterButtons.forEach((filterButton) => filterButton.classList.remove("is-active"));
        button.classList.add("is-active");
        updateCatalog();
    });
});