var step = 18;
var myDot;
var players = new Array();
var wall = new Array();
var wallObjects = new Array();
var PAPER_SIZE = 28;
var myRate = 0;
var myUsername = "";
var paper;
for (var i = 0; i < PAPER_SIZE; i++) wallObjects[i] = new Array();

function renderWallObjects(a) {
    for (var i in wallObjects) for (var j in wallObjects) if (wallObjects[i][j] != undefined) {
        if (wallObjects[i][j].data("y") == (PAPER_SIZE - 1)) {
            wallObjects[i][j].remove();
            delete wallObjects[i][j]
        } else {
            wallObjects[i][j].data("y", wallObjects[i][j].data("y") + 1);
            wallObjects[i][j].attr({
                x: wallObjects[i][j].data("x") * step + 1,
                y: wallObjects[i][j].data("y") * step + 1
            });
            if (myDot != null && myDot.data("x") == wallObjects[i][j].data("x") && myDot.data("y") == wallObjects[i][j].data("y")) {
                if (myDot.data("y") == (PAPER_SIZE - 1)) {
                    myDot.remove();
                    myDot = null;
                    $("#respawn-overlay").show();
                    socket.emit("im-out")
                } else {
                    myDot.data("y", myDot.data("y") + 1);
                    myDot.attr({
                        x: myDot.data("x") * step,
                        y: myDot.data("y") * step
                    });
                    socket.emit("dot-moved", {
                        x: myDot.data("x"),
                        y: myDot.data("y")
                    })
                }
            }
        }
    }
    var b = [];
    for (var j in wall[0]) if (wall[0][j] == 1) {
        b[j] = a.rect(j * step + 1, 2, 15, 15).attr({
            "fill": "#00BFA9",
            "stroke-width": "0"
        });
        b[j].data("x", j);
        b[j].data("y", 0);
        if (myDot != null && myDot.data("x") == j && myDot.data("y") == 0) {
            myDot.data("y", 1);
            myDot.attr({
                x: myDot.data("x") * step,
                y: myDot.data("y") * step
            });
            socket.emit("dot-moved", {
                x: myDot.data("x"),
                y: myDot.data("y")
            })
        }
    }
    wallObjects.unshift(b);
    while (wallObjects.length > PAPER_SIZE) wallObjects.pop()
}
function positionTaken(x, y) {
    for (var i in players) if (players[i].data("x") == x && players[i].data("y") == y) return true;
    for (var i in wall) for (var j in wall[i]) if (wall[i][j] == 1 && x == j && y == i) return true;
    return false
}
$(document).ready(function () {
    paper = Raphael("canvas", 550, 550);
    paper.drawGrid(0, 0, 503, 503, PAPER_SIZE, PAPER_SIZE, "#666");
    socket = io.connect("http://"+window.location.hostname, {
        port: 8002
    });
    $("#submit-username").submit(function (a) {
        a.preventDefault();
        socket.emit("update-username", {
            username: $("#uname").val(),
            password: $("#pass").val()
        });
        $(this).attr("disabled", true)
    });
    $("#respawn-btn").click(function () {
        reviveMyDot();
        $("#respawn-overlay").hide()
    });
    socket.on('username-ok', function (a) {
        $("#sign-in-block").html("Welcome, <b>" + a.username + "</b>");
        myUsername = a.username;
        if (a.rating != undefined) {
            myRate = a.rating;
            $("#myrate").html(myRate)
        }
    });
    socket.on('username-err', function (a) {
        alert("Login error. Username already in use or password is wrong.");
        $(this).attr("disabled", false)
    });
    socket.on('some-dot-out', function (a) {
        players[a.id].remove();
        delete players[a.id]
    });
    socket.on('total-users', function (a) {
        $("#users-online").html(a.total);
        for (var b in a.users) {
            players[b] = paper.rect(0, 0, 18, 18).attr({
                "fill": "#C95370",
                "stroke": "#ccc"
            });
            players[b].data("x", a.users[b].x);
            players[b].data("y", a.users[b].y);
            players[b].attr({
                x: a.users[b].x * step,
                y: a.users[b].y * step
            })
        }
    });
    socket.on('labyr-move', function (a) {
        var b = a.line;
        wall.unshift(b);
        while (wall.length > PAPER_SIZE) wall.pop();
        renderWallObjects(paper)
    });
    socket.on('update-toplist', function (a) {
        $("#rating-table > tbody").html("");
        var b = 1;
        for (var i in a.users) {
            if (a.users[i].username == null) a.users[i].username = "Noname";
            if (myUsername == a.users[i].username) $("#myrate").html(a.users[i].rating);
            $("#rating-table > tbody:last").append('<tr> <td>' + (b++) + '</td> <td>' + a.users[i].username + '</td> <td>' + a.users[i].rating + '</td> </tr>')
        }
    });
    socket.on('some-dot-moved', function (a) {
        if (players[a.id] == undefined) players[a.id] = paper.rect(0, 0, 18, 18).attr({
            "fill": "#C95370",
            "stroke": "#ccc"
        });
        players[a.id].data("x", a.x);
        players[a.id].data("y", a.y);
        players[a.id].animate({
            "1%": {
                x: a.x * step,
                y: a.y * step
            }
        }, 50)
    });
    socket.on('some-dot-created', function (a) {
        if (players[a.id] == undefined) players[a.id] = paper.rect(0, step * (PAPER_SIZE - 1), 18, 18).attr({
            "fill": "#C95370",
            "stroke": "#ccc"
        });
        players[a.id].data("x", 0);
        players[a.id].data("y", (PAPER_SIZE - 1));
        players[a.id].attr({
            x: 0,
            y: step * (PAPER_SIZE - 1)
        });
        $("#users-online").html(a.total)
    });
    socket.on('dot-leaved', function (a) {
        $("#users-online").html(a.total);
        players[a.id].remove();
        delete players[a.id]
    });
    myDot = paper.rect(0, step * (PAPER_SIZE - 1), 18, 18).attr({
        "fill": "#3f72bf",
        "stroke": "#ccc",
        "stroke-width": "1"
    });
    socket.emit("dot-created");
    myDot.data("x", 0);
    myDot.data("y", (PAPER_SIZE - 1));
    $(document).keydown(function (e) {
        if (myDot == null) return true;
        switch (e.keyCode) {
        case 65:
        case 37:
            if (positionTaken(myDot.data("x") - 1, myDot.data("y"))) return;
            if (myDot.data("x") == 0) return;
            myDot.data("x", myDot.data("x") - 1);
            break;
        case 87:
        case 38:
            if (positionTaken(myDot.data("x"), myDot.data("y") - 1)) return;
            if (myDot.data("y") == 0) return false;
            myDot.data("y", myDot.data("y") - 1);
            break;
        case 68:
        case 39:
            if (positionTaken(myDot.data("x") + 1, myDot.data("y"))) return;
            if (myDot.data("x") >= (PAPER_SIZE - 1)) return;
            myDot.data("x", myDot.data("x") + 1);
            break;
        case 83:
        case 40:
            if (positionTaken(myDot.data("x"), myDot.data("y") + 1)) return;
            if (myDot.data("y") >= (PAPER_SIZE - 1)) return;
            myDot.data("y", myDot.data("y") + 1);
            break
        }
        myDot.animate({
            "1%": {
                x: myDot.data("x") * step,
                y: myDot.data("y") * step
            }
        }, 50);
        socket.emit("dot-moved", {
            x: myDot.data("x"),
            y: myDot.data("y")
        })
    })

    // setInterval(function()
    // {
    // }, 10)
});

function reviveMyDot() {
    if (myDot != null) return;
    myDot = paper.rect(0, step * (PAPER_SIZE - 1), 18, 18).attr({
        "fill": "#3f72bf",
        "stroke": "#ccc",
        "stroke-width": "1"
    });
    myDot.data("x", 0);
    myDot.data("y", (PAPER_SIZE - 1));
    socket.emit("dot-created", {
        rating: myRate
    })
}
