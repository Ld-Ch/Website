document.addEventListener("DOMContentLoaded", function() {
    const styleHTML = 
        `<div>
            <link rel="stylesheet" href="style.css">
            <link rel="icon" href="/ICON.ico" type="image/x-icon">
        </div>`;
    const navbarHTML = `
    <header id="header">
        <div id="navbar">
            <div id="icon">
                <a href="/index.html"><img id="icon-ico" src="/ICON.ico" alt="deyi icon" style="width: 70px; margin: 3px"></a>
            </div>
            <ul class="nav-list">
                <li><a href="home.html">main page</a></li>
                <li><a href="#">intro or something </a></li>
                <li><a href="game.html">part 2 or something</a></li>
                <li><a href="test.html">also 4th option here</a></li>
            </ul>
        </div>
    </header>    `;
    document.body.insertAdjacentHTML('afterbegin', navbarHTML);
});
