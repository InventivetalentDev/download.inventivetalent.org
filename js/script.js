var downloadApp = angular.module("downloadApp", ["ngRoute"]);


downloadApp.config(function ($routeProvider, $locationProvider) {

    $routeProvider
        .when("/", {
            templateUrl: "empty.html"
        })
        .when("/:provider/:project", {redirectTo: "/:provider/:project/latest"})
        .when("/:provider/:project/:version/:meta?", {
            templateUrl: "download.html",
            controller: "downloadController"
        });

    $locationProvider.html5Mode(true);
});

downloadApp.controller("parentController", ["$scope", function ($scope) {
    $scope.pageTitle = "Download";
}])

downloadApp.controller("downloadController", ["$scope", "$location", "$routeParams", "$http", "$timeout", function ($scope, $location, $routeParams, $http, $timeout) {
    console.log($routeParams);
    $scope.patreonLoggedIn = false;
    $scope.download = {
        params: $routeParams,
        provider: {
            friendlyName: undefined,
            urlFormat: undefined
        },
        url: {
            direct: "",
            adfly: "",
            donate: ""
        },
        go: {
            direct: function () {
                $scope.trackDownloadClick("direct");
                $timeout(function () {
                    window.location = $scope.download.url.direct();
                }, 250);
            },
            adfly: function () {
                $scope.trackDownloadClick("adfly");
                $timeout(function () {
                    window.location = $scope.download.url.adfly();
                }, 250);
            },
            donate: function () {
                $scope.trackDownloadClick("donate");
                $timeout(function () {
                    window.location = $scope.download.url.donate();
                }, 250);
            },
            donate_direct: function () {
                $scope.trackDownloadClick("donate-direct");
                $timeout(function () {
                    window.location = $scope.download.url.direct();
                }, 250);
            }
        },
        donateAmount: Math.floor(Math.random() * 20) + 1,
        referrerId: undefined,
        resourceIconData: "",
        adflyFailed: false
    };
    if (!$scope.download.params.version) {
        $scope.download.params.version = "latest";
    }
    $scope.$watch("download.donateAmount", function (val, old) {
        $scope.download.donateAmount = parseFloat(val);
        console.log($scope.download.donateAmount)
    })
    $scope.providers = {
        "GitHub": {
            keys: [
                "gh",
                "github"
            ],
            urlFormat: "https://github.com/InventivetalentDev/:project/releases/:version"
        },
        "InventiveDownloads": {
            keys: [
                "idl"
            ],
            urlFormat: "https://dl.inventivetalent.org/plugin/?plugin=:project&version=:version"
        }
    };
    $.each($scope.providers, function (friendlyName, provider) {
        $.each(provider.keys, function (index, key) {
            if (key === $scope.download.params.provider) {
                $scope.download.provider.friendlyName = friendlyName;
                $scope.download.provider.urlFormat = provider.urlFormat;
            }
        })
    });
    console.info("Download Provider is " + $scope.download.provider.friendlyName);
    if (!$scope.download.provider.friendlyName || !$scope.download.provider.urlFormat) {
        alert("Unknown Download Provider");
    }

    $scope.showDownloadModal = function () {
        $("#downloadModal").modal("show")
    }

    $scope.trackDownloadClick = function (type) {
        if (typeof ga !== 'undefined') {
            console.log("Tracking " + type + " download via 'ga'")
            ga("send", "event",
                "project_download", "click", type, undefined, {
                    "nonInteraction": 1
                });
        } else if (typeof _gaq !== 'undefined') {
            console.log("Tracking " + type + " download via '_gaq'")
            _gaq.push(['_trackEvent',
                "project_download", "click", type, undefined, true]);
        } else {
            console.warn("No GoogleAnalytics tracking APIs available")
        }
    };

    // Generate URLs
    $timeout(function () {
        // update title
        $scope.pageTitle = "Download " + $scope.download.params.project + " " + $scope.download.params.version;
        console.log($scope.pageTitle);

        $scope.download.url.direct = function () {
            return $scope.download.provider.urlFormat
                .replace(":project", $scope.download.params.project)
                .replace(":version", $scope.download.params.version);
        };

        $scope.download.url.donate = function () {
            return "https://download.inventivetalent.org/external/paypal/go?url=" + btoa($scope.download.url.direct()) +
                "&amount=" + $scope.download.donateAmount +
                "&i_provider=" + $scope.download.params.provider +
                "&i_project=" + $scope.download.params.project +
                "&i_version=" + $scope.download.params.version;
        };

        console.log("Checking Patreon status...");
        if (document.cookie.indexOf("patreon_id") !== -1) {
            $scope.patreonLoggedIn = true;
        }
        $("#patreon-login-link").attr("href", "https://download.inventivetalent.org/patreon/redirect.php?provider=" + $scope.download.params.provider + "&plugin=" + $scope.download.params.project + "&version=" + $scope.download.params.version);
        $http({
            url: "/patreon/check.php"
        }).then(function (response) {
            if (response.status === 200 && "true" === response.data) {
                $scope.patreonLoggedIn = true;
                $scope.trackDownloadClick("patreon-auto");
                $timeout(function () {
                    window.location = $scope.download.url.direct();
                }, 250);
            } else {
                $scope.patreonLoggedIn = false;
            }
        });

        console.log("Generating adfly link...");
        $http({
            url: "/external/adfly/make.php?url=" + btoa($scope.download.url.direct())
        }).then(function (response) {
            $timeout(function () {
                $scope.download.url.adfly = function () {
                    return response.data.shortened;
                };
            });
        }, function (error) {
            console.warn(error);
            $scope.adflyFailed = true;
        });


        // Load info based on referrer
        if (document.referrer && document.referrer.startsWith("https://www.spigotmc.org/resources/")) {
            var substr = document.referrer.substring("https://www.spigotmc.org/resources/".length);
            var pathSplit = substr.split("/");// in case the user came from the version history, etc.
            var resourceString = pathSplit[0];
            var split = resourceString.split(".");

            var resourceId = parseInt(split[1]);
            console.info("Detected referrer resource #" + resourceId + " (" + split[0] + ")");
            $scope.download.referrerId = resourceId;
            $http({
                url: "https://api.spiget.org/v2/resources/" + resourceId + "/icon/raw",
                headers: {"Spiget-User-Agent": "download.inventivetalent.org"}
            }).then(function (response) {
                $scope.download.resourceIconData = response.data;
            })
        }

    }, 500);

    $scope.submitIssue = function () {
        var url = "https://github.com/InventivetalentDev/download.inventivetalent.org/issues/new?title=";
        url += encodeURI("Download Issue (" + window.location + ")");
        window.open(url, "_blank");
    };
}]);
