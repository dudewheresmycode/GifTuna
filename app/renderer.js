// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const {ipcRenderer} = require('electron')
const {dialog} = require('electron').remote
const {shell} = require('electron')
const path = require('path');

global.$ = global.jQuery = require('jquery');
global.angular = global.angular = require('angular');

// global.$.minicolors = require('@claviska/jquery-minicolors');
require('@claviska/jquery-minicolors');


$(function(){
  $('body').on('focus', 'input[type=number]', function (e) {
    $(this).on('mousewheel.disableScroll', function (e) {
      e.preventDefault()
    })
  })
  $('body').on('blur', 'input[type=number]', function (e) {
    $(this).off('mousewheel.disableScroll')
  })
});

angular.module('gifwhiz', [])
.filter('framerate', function(){
  return function(input, suffix){
    if(!input){
      return '-';
    }
    var fr = input.split('/');
    var r = (parseInt(fr[0])/parseInt(fr[1]));
    if(suffix){
      return r+' fps';
    }
    return r;
    //scope.frames = Math.ceil(nv*rate);
  }
})
.filter('ratio', function(){
  return function(x){

    var tolerance = 1.0E-6;
    var h1=1; var h2=0;
    var k1=0; var k2=1;
    var b = x;
    do {
        var a = Math.floor(b);
        var aux = h1; h1 = a*h1+h2; h2 = aux;
        aux = k1; k1 = a*k1+k2; k2 = aux;
        b = 1/(b-a);
    } while (Math.abs(x-h1/k1) > x*tolerance);

    return h1+":"+k1;

  }
})
.directive('dragDrop', function($rootScope,$timeout,$parse,$filter){
  return {
    link: function(scope,ele,attr){
      var element = ele.get(0);
      var dragOn = false;
      var dragged;
      // document.ondrag = function( event ) {
      //   console.log('ondrag')
      // }
      document.ondragstart = function(e){
        dragged = event.target;
        scope.dragActive=true;
        scope.$apply();
      }
      document.ondragend = function(e){
        scope.dragActive=false;
        scope.$apply();
      }
      document.ondragover = function(e){
        dragged = event.target;
        scope.dragActive=true;
        scope.$apply();
        event.preventDefault();
      }
      window.dragexit = function(e){
        if(e.target.className==dragged.className){
          scope.dragActive=false;
          scope.$apply();
        }
      }
      window.ondragleave = function(e){
        if(e.target.className==dragged.className){
          scope.dragActive=false;
          scope.$apply();
        }
      }

      document.ondrop = function(e){
        e.preventDefault();
        scope.dragActive=false;
        var input = e.dataTransfer.files[0];
        // var input = e.target.files[0];
        $rootScope.currentTime=0;
        $rootScope.currentSource.source.file = input;
        $rootScope.$apply();
        $rootScope.currentSource.source.working=true;
        ipcRenderer.send('probeInput', input.path)


        return false;
      }

    }
  }
})
.directive('pixelPalette', function($rootScope,$timeout,$parse,$filter){
  return {
    templateUrl: 'tpl/pixel-palette.html',
    scope: {
      src:'=',
      colors:'='
      // ngModel:'='
    },
    // require:'ngModel',

    link: function(scope,ele,attr){
      $rootScope.$watch('currentSource.output.generatingPalette',function(nv){
        scope.working = nv;
      });
      // $timeout(function(){
        $(ele).find('#color-input').minicolors({
          format:'rgb',
          inline:true,
          change: function(value, opacity) {
            var rgb = $(this).minicolors('rgbObject');
            $timeout(function() {
              scope.pixels[scope.status.pixelIndex] = [rgb.r,rgb.g,rgb.b];
              scope.status.hexColor = RGBToHex(rgb.r,rgb.g,rgb.b);

//              scope.pixels[0];
              put_palette();
            });
            // if(!scope.$$phase) scope.$apply();
            // console.log(value, opacity, rgb);
          }
        });
      // },0);
      scope.status = {pickerIsOpen:false, color:null, position:{x:0,y:0}};
      var RGBToHex = function(r,g,b){
          var bin = r << 16 | g << 8 | b;
          return (function(h){
              return new Array(7-h.length).join("0")+h
          })(bin.toString(16).toUpperCase())
      }

      scope.pickMe = function(index,$event){
        var color = scope.pixels[index];
        console.log(ele.find(".pixel").eq(index));

        $(ele).find('#color-input').minicolors('value', "rgb("+color.join(',')+")");
        scope.status.color = "rgb("+color.join(',')+")";
        scope.status.hexColor = RGBToHex(color[0],color[1],color[2]);
        scope.status.pixelIndex = index;
        scope.status.pickerIsOpen = true;
        scope.status.position.x = ele.find(".pixel").eq(index).offset().left;
        scope.status.position.y = ele.find(".pixel").eq(index).offset().top + 10;
        if($event){
          $event.preventDefault();
          $event.stopPropagation();
        }
      }
      $rootScope.$on('pixelClick',function(evt,color){
        console.log("COLOR", color);
        var idx = scope.pixels.findIndex(function(p){
          // console.log(p,color);
          for(var i=0;i<4;i++){
            if(p[i]!=color[i]) return false;
          }
          return true;
          // return angular.equals(p,color);
        })
        console.log("COLOR", evt,color,idx);
        scope.pickMe(idx);

      });
      $('.colorpicker').on('click',function(e){
        // e.preventDefault();
        e.stopPropagation();
      });
      $('body').on('click',function(e){
        scope.status.pickerIsOpen = false;
        scope.$apply();
      });
      scope.$cp_pos = function(){
        return {
          display:scope.status.pickerIsOpen?'block':'none',
          left:(scope.status.position.x)+'px',
          top:scope.status.position.y+'px'
        };
      }

      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = 16;
      canvas.height = 16;
      scope.pixels = [];
      scope.$color = function(c){
        return {
          'background-color': "rgb("+c[0]+","+c[1]+","+c[2]+")"
        }
      }
      // scope.$watch('ngModel',function(nv){
      //   if(nv){
      //     console.log("Source change", nv);
      //     read_palette(nv);
      //   }
      // });
      $rootScope.$on('newPalette',function(){
        read_palette($rootScope.colorPalette);
      })

      function put_palette(){
        if(scope.pixels.length>0){
          var canvas_copy = document.createElement('canvas');
          var ctx_copy = canvas_copy.getContext('2d');

          var idata = ctx_copy.getImageData(0,0,16,16);
          for(var i=0;i<idata.data.length;i+=4){
            var pixel = Math.floor(i/4);
            idata.data[i] = scope.pixels[pixel] ? scope.pixels[pixel][0] : 0;
            idata.data[i+1] = scope.pixels[pixel] ? scope.pixels[pixel][1] : 0;
            idata.data[i+2] = scope.pixels[pixel] ? scope.pixels[pixel][2] : 0;
            idata.data[i+3] = 255;
          }
          // for(var i=0;i<scope.pixels.length;i++){
          //   data[i] = scope.pixels[i][0] || 0;
          //   data[i+1] = scope.pixels[i][1] || 0;
          //   data[i+2] = scope.pixels[i][2] || 0;
          //   data[i+3] = 255;
          // }
          // console.log(data);
          ctx.putImageData(idata,0,0);
          var uri = canvas.toDataURL("image/png").split('base64,')[1];
          $rootScope.colorPalette = uri;
          // ngModelCtl.$setViewValue(uri);
          // ngModelCtl.$render();
          $rootScope.$emit('colorPaletteChange');
        }
      }

      function read_palette(img_src){
        var img = new Image();
        img.src = 'data:image/png;base64,'+img_src;
        ctx.clearRect(0,0,16,16);
        ctx.drawImage(img,0,0);
        scope.pixels = [];
        var pixel_data = ctx.getImageData(0,0,16,16);
        for(var i=0;i<pixel_data.data.length;i+=4){
          var p = [];
          p[0] = pixel_data.data[i];
          p[1] = pixel_data.data[i+1];
          p[2] = pixel_data.data[i+2];
          p[3] = 255;
          if(scope.pixels.length < scope.colors) scope.pixels.push(p);
        }
        // scope.pixels.push([0,0,0,0]);
        // ngModelCtl.$setViewValue(canvas.toDataURL("image/png").split('base64,')[1]);
        // ngModelCtl.$render();

        // for(var x=0;x<16;x++){
        //   for(var y=0;y<16;y++){
        //     pixels.push(ctx.getImageData(x,y,1,1))
        //   }
        // }

      }

    }
  }
})
.directive('frameScrubber', function($rootScope,$filter){
  return {
    scope: {
      duration:'=',
      // frames:'=',
      framerate:'='
      // ngModel:'='
    },
    // require:'ngModel',
    // template:'<input ng-disabled="!(frames>1)" ng-model-options="{debounce: 200 }" type="range" min="0" ng-model="params.value" />',
    templateUrl: 'tpl/frame-scrubber.html',
    link: function(scope,ele,attr){//ngModelCtl
      scope.$input = $(ele).find('input');
      scope.params = {value:0};
      scope.$next = function(){
        if(scope.params.value < scope.frames) scope.params.value++;
      }
      scope.$prev = function(){
        if(scope.params.value > 0) scope.params.value--;
      }
      scope.$watch('duration',function(nv){
        if(nv){
          scope.frames = Math.floor(nv*scope.framerate);
          // if(!scope.frames){
          //   // var fr = scope.framerate.split('/');
          //   // var rate = (parseInt(fr[0])/parseInt(fr[1]));
          //   // var rate = $filter('framerate')(scope.framerate);
          //   var rate =
          //   scope.frames = Math.ceil(nv*rate);
          // }
          scope.$input.attr('max',scope.frames);
          //scope.params.frames = nv*1000;
        }
      })
      scope.$watch('params.value', function(frame){

        var seekTime = 0;
        if(frame > 0){
          // var fr = scope.framerate.split('/');
          // var rate = (parseInt(fr[0])/parseInt(fr[1]));
          seekTime = frame/scope.framerate;
        }
        $rootScope.currentTime=seekTime;
        if($rootScope.currentSource.source.file){
          $rootScope.currentSource.thumbnail={};
          $rootScope.currentSource.source.working=true;
          ipcRenderer.send('getRawThumbnail', $rootScope.currentSource.source.file.path, seekTime);
          // if(!$rootScope.currentSource.output.working){
          $rootScope.currentSource.output.working=true;
          ipcRenderer.send('getGifThumbnail', $rootScope.currentSource.source.file.path, seekTime, $rootScope.prefs, $rootScope.colorPalette);
          // }
        }
        // ngModelCtl.$setViewValue(frame);
        // ngModelCtl.$render();
      });
    }
  }
})
.directive('sourcePreview', function($rootScope,$timeout){
  return {
    scope: {
      title: '=',
      width: '=',
      height: '=',
      thumbnail: '=',
      working: '='
    },
    //template: '<div class="preview-container" ng-style="$contain()"><div class="preview" ng-style="$style()"></div></div>',
    templateUrl:'tpl/source-preview.html',
    link: function(scope,ele,attr){

      var prom = $timeout();
      var $content = ele.find(".preview-content");
      scope.hasScrolled=false;
      scope.hasScrolls = false;
      scope.zooms = [
        {value:0, label:'Fit'},
        {value:0.25, label:'25%'},
        {value:0.5, label:'50%'},
        {value:0.75, label:'75%'},
        {value:1, label:'100%'},
        {value:1.5, label:'150%'},
        {value:2, label:'200%'},
        {value:3, label:'300%'},
        {value:4, label:'400%'},
        {value:5, label:'500%'},
        {value:10, label:'1000%'}
      ];
      scope.zoom = 1;


      scope.$zoom = function(inout){
        var nearest = scope.zooms.findIndex(function(v,idx){
          return (v.value >= scope.currentScale);
        });
        if(!inout){
          nearest = nearest > -1 ? nearest-1 : nearest;
          if(nearest > 0){
            scope.zoom = scope.zooms[nearest].value;
          }
        }else{
          nearest = nearest < scope.zooms.length ? nearest+1 : nearest;
          scope.zoom = scope.zooms[nearest].value;
        }
        console.log('nearest', nearest);
        // var idx = scope.zooms.findIndex(function(it){ return it.value==scope.zoom; });
      }
      scope.$fit = function(){
        scope.zoom=0;
      }

      // scope.$pixelClick = function($event){
      $content.find('.preview').on('click',function(e){
        var x = Math.round(scope.width*((e.offsetX/$content.width()) / scope.zoom));
        var y = Math.round(scope.height*((e.offsetY/$content.height()) / scope.zoom));
        var color = getPixelColor(scope.width,scope.height,x,y);
        console.log(x, y, color);

        e.preventDefault();
        e.stopPropagation();

        $rootScope.$emit('pixelClick', color);


        function getPixelColor(w,h,x,y){
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          var img = new Image();
          img.src = scope.thumbnail;
          ctx.drawImage(img,0,0);
          return ctx.getImageData(x,y,1,1).data;
          // return d.slice(0,3);
        }
      });
      // $rootScope.zooms = ['Fit','25%','50%','100%','200%','300%','400%','500%'];
      // $rootScope.zoom = {output:'Fit',source:'Fit'};


      // $scope.$watch('zoom',function(zoom){
      //   if(zoom){
      //
      //   }
      // },true);




      var metaKeyOn = false;
      // var lastScrollTop = 0;
      //
      $(window).on('keydown',function(e){
        if(e.altKey){
          metaKeyOn=true;
          // console.log()
        }
      })
      .on('keyup',function(e){
        // if(e.altKey){
          metaKeyOn=false;
          // console.log()
        // }
      });
      $(ele).bind('mousewheel', function(e){
        if(metaKeyOn){
          if(e.originalEvent.wheelDelta /120 > 0) {
              scope.$zoom(true);
              scope.$apply();
              //if(scope.zoom < 10) scope.zoom += 0.1; scope.$apply();

          }
          else{
            //if(scope.zoom > 0.10) scope.zoom -= 0.1; scope.$apply();
              scope.$zoom(false);
              scope.$apply();
          }
        }
      });
      // var startx = 0, starty=0;
      // $content.on('scroll', function(e){
      //   console.log('scroll');
      //   scope.hasScrolled=true;
      //   scope.$apply();
      // });
      //   console.log(e.metaKey, e.altKey, e.shiftKey);
      //   if(metaKeyOn){
      //     e.preventDefault();
      //     var st = $(this).scrollTop();
      //     if (st > lastScrollTop){
      //         // downscroll code
      //     } else {
      //        // upscroll code
      //     }
      //     lastScrollTop = st;
      //
      //     console.log("ALT SCROLL!");
      //   }
      //
      // });


      // $panzoom.parent().on('mousewheel.focal', function( e ) {
      //   e.preventDefault();
      //   var delta = e.delta || e.originalEvent.wheelDelta;
      //   var zoomOut = delta ? delta < 0 : e.originalEvent.deltaY > 0;
      //   $panzoom.panzoom('zoom', zoomOut, {
      //     animate: true,
      //     focal: e
      //   });
      // });
      //
      $(window).on('resize',function(){
        // if(scope.zoom==0){
          // scope.zoom = null;
          $timeout.cancel(prom);
          prom = $timeout(function(){
            scope.zoom = angular.copy(scope.zoom);
          },500);
        // }
        // if(!$rootScope.$$phase) {
        //   $rootScope.$apply();
        // }
      });

      function dimensions(obj,pad){
        var w = scope.width;
        var h = scope.height;
        if(scope.zoom==0){
          if(scope.width > scope.height){
            setByWidth(obj);
            if(obj.height > $content.height()){
              setByHeight(obj);
            }
          }else{
            setByHeight(obj);
            if(obj.width > $content.width()){
              setByWidth(obj);
            }
          }

        }else if(scope.zoom > 0){

          scope.currentScale = scope.zoom;
          obj.width = w*scope.zoom;
          obj.height = h*scope.zoom;
          // if(pad){
          //   obj.padding = '30px 0 0 30px';
          //   obj.width = obj.width+pad;
          //   obj.height = obj.height+pad;
          // }
        }

        var t = ($content.height()-obj.height)/2;
        obj.top = (t > 0 ? t : 0)+'px';
        if((obj.width > $content.width() || obj.height > $content.height())){
          scope.hasScrolls = true;
          // if(!scope.hasScrolled){
          //   $content.scrollTop((obj.height - $content.height())/2);
          //   $content.scrollLeft((obj.width - $content.width())/2);
          // }
        }else{
          scope.hasScrolls = false;
          scope.hasScrolled = false;
        }

        function setByWidth(){
          scope.currentScale = ($content.width()/scope.width);
          obj.width = $content.width();
          obj.height = scope.height * scope.currentScale;
        }
        function setByHeight(){
          scope.currentScale = ($content.height()/scope.height);
          obj.height = $content.height();
          obj.width = scope.width * scope.currentScale;
        }
        return obj;
      }


      scope.$contain = function(){
        var obj = {};
        var w = scope.width;
        var h = scope.height;
        // if(w>0 && h>0){
        //   obj = {
        //     width: w+'px',
        //     height: h+'px'
        //   };
        //   obj = dimensions(obj);
        //   var t = (ele.height()-obj.height)/2;
        //   t = t > 0 ? t : 0;
        //   // obj['margin-top'] = '-'+t+'px';
        //   // obj.top = t+'px';
        // }
        return obj;
      }

      scope.$style = function(){
        //  style="image-rendering: pixelated;"
        // var z = scope.zoom ? scope.zoom.replace('%','') : null;
        // z = parseInt(z);
        var obj = {
          width:scope.width+'px',
          height:scope.height+'px',
          'image-rendering' : scope.zoom > 1 ? "pixelated" : "auto"
          // 'padding-top': ((scope.height/scope.width)*100).toFixed(2)+'%'
        };
        if(scope.thumbnail) obj['background-image'] = 'url('+scope.thumbnail+')';

          obj = dimensions(obj);

        // obj = dimensions(obj);
        return obj;
      }
    }
  }
})
.directive('fileInputButton', function($rootScope){
  return {
    link: function(scope,ele,attr){
      var file = document.createElement('input');
      file.type='file';
      file.accepts = 'video/*,image/*';

      $(file).on('change',function(e){
        var input = e.target.files[0];
        $rootScope.currentTime=0;
        $rootScope.currentSource.source.file = input;
        $rootScope.$apply();
        $rootScope.currentSource.source.working=true;
        ipcRenderer.send('probeInput', input.path)

      });
      $(ele).on('click',function(e){
        file.click();
      });
    }
  }
})
.controller('main', function($scope,$rootScope,$timeout){
  $rootScope.currentSource = {thumbnail:{}, source:{file:null, working:false}, output:{working:false}};
  $rootScope.statsModes = ['full','diff'];
  $rootScope.ditherModes = ['none','bayer','heckbert','floyd_steinberg','sierra2','sierra2_4a'];

  ipcRenderer.on('ffmpegResult',function(evt,obj){
    console.log(evt,obj);
  });
  ipcRenderer.send('ffmpegCheck');

  // $rootScope.bayerScales = [0,1,2,3,4,5];
  $rootScope.prefs= {
    aspect_lock:true,
    width:null,
    height:null,
    stats_mode:'diff',
    dither_mode:'bayer',
    transparency: false,
    bayer_scale:2,
    colors: 256,
    fps:24
  };

  $rootScope.currentTime = 0;
  $scope.numColumns = 1;


  $scope.widthChange = function(){
    if($rootScope.prefs.width > 0 && $rootScope.prefs.aspect_lock && $scope.currentSource.stream){
      var ratio = $rootScope.currentSource.stream.height/$rootScope.currentSource.stream.width;
      $rootScope.prefs.height = Math.round($rootScope.prefs.width*ratio);
    }
  }
  $scope.heightChange = function(){
    if($rootScope.prefs.height > 0 && $rootScope.prefs.aspect_lock && $scope.currentSource.stream){
      var ratio = $rootScope.currentSource.stream.width/$rootScope.currentSource.stream.height;
      $rootScope.prefs.width = Math.round($rootScope.prefs.height*ratio);
    }
  }

  $rootScope.exportStatus = {progress:0, frame:0, status:0, totalFrames:1};
  $scope.export = function(){
    dialog.showSaveDialog({title:"Export GIF", defaultPath:'export.gif', buttonLabel:"Export"}, function(file){
      $rootScope.exportStatus.filepath = file;
      $rootScope.exportStatus.filename = path.basename(file);
      $rootScope.exportStatus.status = 1;
      $rootScope.exportStatus.totalFrames = Math.floor($rootScope.currentSource.stream.duration * $rootScope.prefs.fps);
      ipcRenderer.send('exportGif', $rootScope.currentSource.source.file.path, file, $rootScope.colorPalette, $rootScope.prefs);
    });
  }
  $scope.resetExport = function(){
    $rootScope.exportStatus.status = 0;
    $rootScope.exportStatus.frame = 0;
    $rootScope.exportStatus.progress = 0;
  }
  $scope.finderReveal = function(){
    shell.showItemInFolder($rootScope.exportStatus.filepath);
  }

  $scope.promise = $timeout();
  $rootScope.$watch('prefs',function(p){
    if(p){
      $rootScope.exportStatus.totalFrames = $rootScope.currentSource.stream ? Math.floor($rootScope.currentSource.stream.duration * $rootScope.prefs.fps) : 0;
      if($rootScope.currentSource.stream){
        $rootScope.currentSource.output.working=true;
        $rootScope.currentSource.output.generatingPalette=true;
        $timeout.cancel($scope.promise);
        $scope.promise = $timeout(function(){
//          $rootScope.currentSource.output.working=true;
          // ipcRenderer.send('getGifThumbnail', $rootScope.currentSource.source.file.path, $rootScope.currentTime, p, $rootScope.colorPalette);
          ipcRenderer.send('getGifPalette', $rootScope.currentSource.source.file.path, $rootScope.prefs);
          console.log("GEN GIF PALETTE");
        },500);
      }
    }
  },true);



  ipcRenderer.on('probeResult', (event, probe) => {
    console.log(event, probe);
    // var probe = JSON.parse(arg);
    $rootScope.currentSource.format = probe.format;
    var vstream = probe.streams.find(function(it){ return it.codec_type=='video'; });
    if(!vstream){
      console.error("No video stream found!");
      return;
    }
    $rootScope.prefs.aspect = (vstream.width/vstream.height);
    $rootScope.currentSource.stream = vstream;
    $rootScope.exportStatus.totalFrames = ($rootScope.currentSource.stream.duration * $rootScope.prefs.fps);
    $rootScope.prefs.width = vstream.width;
    $rootScope.prefs.height = vstream.height;

    $rootScope.$apply();
    ipcRenderer.send('getRawThumbnail', $rootScope.currentSource.source.file.path, 0)
    // ipcRenderer.send('getGifPalette', $rootScope.currentSource.source.file.path, $rootScope.prefs);
    // $rootScope.generatingPalette=true
    // console.log("GEN GIF PALETTE");
    $rootScope.currentSource.output.working=true;
    $rootScope.currentSource.output.generatingPalette=true;

  });
  ipcRenderer.on('rawThumbnail', (event, resp) => {
    //var img = new Image();
    //img.src = 'data:image/jpeg;base64,'+arg;
    $rootScope.currentSource.thumbnail.source = 'data:image/png;base64,'+resp;
    // $rootScope.currentSource.thumbnail.source = resp;
    $rootScope.currentSource.source.working=false;
    $rootScope.$apply();
    //$("#source-preview").css('background-image', 'url(data:image/jpeg;base64,'+resp+')');
  })
  ipcRenderer.on('gifThumbnail', (event, resp) => {
    //var img = new Image();
    //img.src = 'data:image/jpeg;base64,'+arg;
    console.log("GIF THUMB", event, resp);
    $rootScope.currentSource.thumbnail.output = 'data:image/gif;base64,'+resp.data;
    $rootScope.currentSource.output.working=false;
    // $rootScope.currentSource.thumbnail.output = resp;
    $rootScope.$apply();
    //$("#source-preview").css('background-image', 'url(data:image/jpeg;base64,'+resp+')');
  })
  ipcRenderer.on('gifPalette', (event, resp) => {
    // $rootScope.currentSource.thumbnail.palette = 'data:image/png;base64,'+resp.data;
    // console.log('palette!', resp.data);
    $rootScope.colorPalette = resp.data;
    $rootScope.currentSource.output.generatingPalette=false;
    $rootScope.$emit('newPalette');
    // $rootScope.$emit('colorPaletteChange');
    $rootScope.$apply();
    ipcRenderer.send('getGifThumbnail', $rootScope.currentSource.source.file.path, $rootScope.currentTime, $rootScope.prefs, $rootScope.colorPalette)
  })
  $rootScope.$on('colorPaletteChange',function(){
    $rootScope.currentSource.output.working=true;
    ipcRenderer.send('getGifThumbnail', $rootScope.currentSource.source.file.path, $rootScope.currentTime, $rootScope.prefs, $rootScope.colorPalette);
  });
  ipcRenderer.on('exportProgress', (event, frame) => {
    $rootScope.exportStatus.frame = frame;
    $rootScope.exportStatus.progress = (frame / $rootScope.exportStatus.totalFrames) * 100;
    $rootScope.$apply();
  });
  ipcRenderer.on('exportComplete', (event, resp) => {
    $rootScope.exportStatus.frame = $rootScope.exportStatus.totalFrames;
    $rootScope.exportStatus.progress = 100;
    $rootScope.$apply();
    $timeout(function(){
      $rootScope.exportStatus.status = 2;
    },250);
  });

  $scope.overlayOn = function(){
    return !$rootScope.currentSource.source.file||$rootScope.exportStatus.status>0;
  }
});
