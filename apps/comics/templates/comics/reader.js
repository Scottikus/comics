"use strict";

var COMICS = function () {

    // Set up some global variables
    var MARKDOWN = window.markdownit();
    var CACHE = {};
    var COMIC = {
        "slug": "{{ comic.slug }}",
        "title": "{{ comic.title }}",
    };
    var NUM_ACTIVE_REQUESTS = 0;

    // Make the current comic's data appear in the page
    function loadDataIntoDOM(pageData) {
        // Browser State
        var newTitle = pageData.title + " | " + COMIC.title;
        document.title = pageData.title;

        // Compute Tag HTML
        var tagHTML = "";
        pageData.tag_types.forEach(function (tagType) {
            var tagStrings = "";
            tagType.tags.forEach(function (tag){
                if (tag.icon !== "") {
                    tagStrings += `
                    <a class="tag" href="${tag.url}">
                        <div style="background-image: url(${tag.icon});"></div>&nbsp;${tag.title}
                    </a>`;
                } else {
                    tagStrings += `<a class="tag" href="${tag.url}">${tag.title}</a>`;
                }
            });

            tagHTML += `
            <div class="tag-group">
                <p>${tagType.title}:</p>
                ${tagStrings}
            </div>`;
        });

        // Page Content
        document.getElementById("comic-title").innerHTML = pageData.title;
        document.getElementById("comic-tags").innerHTML = tagHTML;
        document.getElementById("comic-post-date").innerHTML = pageData.posted_at;
        document.getElementById("comic-post").innerHTML = MARKDOWN.render(pageData.post);
        document.getElementById("comic-transcript").innerHTML = MARKDOWN.render(pageData.transcript);
        document.getElementById("comic-image").src = pageData.image;  // TODO: Preload data so it's cached
        document.getElementById("comic-image").title = pageData.alt_text;
        document.getElementById("comic-image").style.opacity = 0.5;
        document.getElementById("comic-image-spinner").style.opacity = 1.0;

        var adminLink = document.getElementById("admin-edit-link");
        if (adminLink) { adminLink.href = pageData.admin; }

        // TODO: Should we scroll to the top of the page?

        // Navigation Buttons
        recalculateNavigationVisibility();
    }

    // Make the navigation buttons appear or disappear
    function recalculateNavigationVisibility() {
        // TODO: Do this with a CSS class
        if (NUM_ACTIVE_REQUESTS > 0) {
            document.getElementsByClassName("comic-navigation")[0].style.opacity = 0.5;
        } else {
            document.getElementsByClassName("comic-navigation")[0].style.opacity = 1.0;
        }

        var page = getActivePageData()

        if (page === undefined) {
            // We're still loading
            return;
        }

        // TODO: Change these into CSS class for "hidden"
        if (page.slug === page.last) {
            document.getElementById("navigation-next").style.display = "none";
            document.getElementById("navigation-last").style.display = "none";
        } else {
            document.getElementById("navigation-next").style.display = "";
            document.getElementById("navigation-last").style.display = "";
        }
        if (page.slug === page.first) {
            document.getElementById("navigation-previous").style.display = "none";
            document.getElementById("navigation-first").style.display = "none";
        } else {
            document.getElementById("navigation-previous").style.display = "";
            document.getElementById("navigation-first").style.display = "";
        }

        document.getElementById("navigation-first").blur();
        document.getElementById("navigation-previous").blur();
        document.getElementById("navigation-next").blur();
        document.getElementById("navigation-last").blur();
    }

    function imageLoaded() {
        document.getElementById("comic-image").style.opacity = 1.0;
        document.getElementById("comic-image-spinner").style.opacity = 0.0;
    }

    function getActivePageData() {
        return CACHE[getComicAndPageFromActiveUrl().pageSlug];
    }

    // Kickstart the page load
    function initializePage() {
        requestPageData(COMIC.slug, getComicAndPageFromActiveUrl().pageSlug, function (response) {
            navigateToPage(response.slug, false);
        });
    };

    function navigateToPage(pageSlug, pushState=true) {
        var pageData = CACHE[pageSlug];

        // This should never happen, but it's protection
        if (pageData === undefined) {
            console.log("Can't navigate, unknown destination. " + pageSlug);
            return;
        }

        // We don't push the state on the initial load or if using the back/forward buttons
        // We also don't care if there are outstanding requests in those cases
        if (pushState) {
            if (NUM_ACTIVE_REQUESTS > 0) {
                console.log("Can't navigate, " + NUM_ACTIVE_REQUESTS + " active requests.");
                return;
            }
            window.history.pushState(pageData, pageData.title, '/' + COMIC.slug + '/' + pageData.slug + "/");
        }

        // Render the new page
        loadDataIntoDOM(pageData);

        // Tell Google Analytics that we successfully loaded the page
        if ("ga" in window && ga.getAll !== undefined) {
            var tracker = ga.getAll()[0];
            if (tracker) {
                tracker.set('page', window.location.pathname);
                tracker.send('pageview');
            }
        }

        // Cache all the pages we can navigate to from this page
        requestPageData(COMIC.slug, pageData.first, function (response) { });
        requestPageData(COMIC.slug, pageData.previous, function (response) { });
        requestPageData(COMIC.slug, pageData.next, function (response) { });
        requestPageData(COMIC.slug, pageData.last, function (response) { });
    }

    // The next 4 functions perform the navigation.
    function firstButtonPressed() {
        navigateToPage(getActivePageData().first);
    }

    function previousButtonPressed() {
        navigateToPage(getActivePageData().previous);
    }

    function nextButtonPressed() {
        navigateToPage(getActivePageData().next);
    }

    function lastButtonPressed() {
        navigateToPage(getActivePageData().last);
    }

    // Make an AJAX request to get data
    function requestPageData(comicSlug, pageSlug, callback) {
        // Don't try to get missing pages
        if (pageSlug === null) {
            return;
        }

        if (CACHE[pageSlug] !== undefined) {
            callback(CACHE[pageSlug]);
            recalculateNavigationVisibility();
            return;
        }

        // Make the nav buttons go transparent
        NUM_ACTIVE_REQUESTS += 1;
        recalculateNavigationVisibility();

        // Execute the request
        var url = "/" + comicSlug + "/data/" + pageSlug + "/";
        var request = new XMLHttpRequest();
        request.onreadystatechange = function() {
            if (request.readyState == 4 && request.status == 200) {
                try {
                    var data = JSON.parse(request.responseText);
                } catch(err) {
                    console.log(err.message + " in " + request.responseText);
                    return;
                }

                // Run the callback and update the navigation state
                CACHE[pageSlug] = data;
                callback(data);

                // Make the nav buttons go opaque
                NUM_ACTIVE_REQUESTS -= 1;
                recalculateNavigationVisibility();

                // Pre-warm the image cache
                preloadImage(data.image);
            }
        };
        request.open("GET", url, true);
        request.send();
    }

    function preloadImage(url) {
        var img = new Image();
        img.onload = function() {
            img.src = "";
            img = null;
        }
        img.src = url;
    }

    function checkKeycode(event) {
        // handling Internet Explorer stupidity with window.event
        // @see http://stackoverflow.com/a/3985882/517705
        var keyDownEvent = event || window.event;
        var keycode = (keyDownEvent.which) ? keyDownEvent.which : keyDownEvent.keyCode;
        var LEFT = 37;
        var RIGHT = 39;
        if (keyDownEvent.altKey) {
            return true;
        }
        if (keycode === LEFT) {
            previousButtonPressed();
            return false;
        } else if (keycode === RIGHT) {
            nextButtonPressed();
            return false;
        }
        return true;
    }
    document.onkeydown = checkKeycode;

    function getComicAndPageFromActiveUrl() {
        var url = new URL(document.location).pathname;
        var split = url.split('/');
        return {"comicSlug": split[1], "pageSlug": split[2]};
    }

    // TODO: handle routing like this instead. This captures only back/forward navigation, so we need to also capture
    // pushstate
    window.onpopstate = function(event) {
        navigateToPage(getComicAndPageFromActiveUrl().pageSlug, false);
    };

    // Run the initialization and then publish any variables that need to be public.
    return {
        initializePage: initializePage,
        firstButtonPressed: firstButtonPressed,
        previousButtonPressed: previousButtonPressed,
        nextButtonPressed: nextButtonPressed,
        lastButtonPressed: lastButtonPressed,
        imageLoaded: imageLoaded,
    };
}();

document.addEventListener("DOMContentLoaded", function(event) {
    COMICS.initializePage();
});
