document.addEventListener("DOMContentLoaded", function () {
    // Check how deep we are in the folder structure
    const currentPath = window.location.pathname;
    const depth = currentPath.split("/").length - 2; // -2 because the first item is empty and last is file.html

    // Create prefix like '', '../', '../../' etc.
    const prefix = depth === 0 ? '' : '../'.repeat(depth);

    const navHTML = `
        <ul class='navbar'>
            <li><a href='${prefix}index.html'>Home</a></li>
            <li class='dropdown'>
                <a href='${prefix}equipment.html' class='dropbtn'>Equipment</a>
                <ul class='dropdown-content'>
                    <li><a href='${prefix}camera.html'>Camera</a></li>
                    <li><a href='${prefix}camacc.html'>Camera Accessories</a></li>
                    <li><a href='${prefix}optikk.html'>Optikk</a></li>
                    <li><a href='${prefix}monitor.html'>Monitor</a></li>
                    <li><a href='${prefix}fokus.html'>Fokus</a></li>
                    <li><a href='${prefix}wireless.html'>Wireless</a></li>
                    <li><a href='${prefix}batteri.html'>Battery</a></li>
                    <li><a href='${prefix}lys.html'>Light</a></li>
                    <li><a href='${prefix}grip.html'>Grip</a></li>
                    <li><a href='${prefix}lyd.html'>Sound</a></li>
                    <li><a href='${prefix}filter.html'>Filter</a></li>
                    <li><a href='${prefix}tralle.html'>Carts</a></li>
                    <li><a href='${prefix}power.html'>Power and EL</a></li>
                    <li><a href='${prefix}data-stream.html'>Data/Stream</a></li>
                    <li><a href='${prefix}cables.html'>Cables</a></li>
                    <li><a href='${prefix}alleq.html'>All Search</a></li>
                </ul>
            </li>
            <li class='dropdown'>
                <a href='${prefix}Contact.html' class='dropbtn'>Contact</a>
                <ul class='dropdown-content'>
                    <li><a href='${prefix}About.html'>About</a></li>
                    <li><a href='${prefix}Contact.html'>Contact</a></li>
                </ul>
            </li>
        </ul>
    `;

    const navContainer = document.getElementById("main-navbar");
    if (navContainer) {
        navContainer.innerHTML = navHTML;
    }
});
