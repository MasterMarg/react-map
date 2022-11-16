import * as React from 'react';
import mapConfig from '../config.json';
import { Style, Icon, Stroke, Fill, Text } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat, get } from 'ol/proj';
import MapComponent from '../components/Map/MapComponent';
import Toolbar from '@mui/material/Toolbar';
import Layers from '../components/Layers/Layers';
import TileLayer from '../components/Layers/TileLayer';
import * as olSource from 'ol/source';
import VectorLayer from '../components/Layers/VectorLayer';
import GeoJSON from 'ol/format/GeoJSON';
import oilIcon from '../resources/Нефть.png';
import gasIcon from '../resources/Газ.png';
import { blue } from '@mui/material/colors';
import Collection from 'ol/Collection';
import { Circle, LineString, Polygon } from 'ol/geom';
import WKT from 'ol/format/WKT';
import { getContext } from 'ol/webgl';

const markersLonLat = [mapConfig["cit-c-point1"], mapConfig["cit-c-point2"], mapConfig["cit-c-point3"],
  mapConfig["cit-c-point4"], mapConfig["cit-c-point5"], mapConfig["cit-c-point6"]];

function addMarkers(lonLatArray) {
  let iconStyle = new Style({
    image: new Icon({
      src: oilIcon,
      scale: 0.25,
    }),
    text: new Text({
      font: 'bold italic 15px serif',
      offsetX: 40,
      text: "Нефть"
    })
  });
  let features = lonLatArray.map((item) => {
    let feature = new Feature({
      geometry: new Point(fromLonLat(item.geometry)),
      description: item.description,
    });
    feature.setStyle(iconStyle);
    return feature;
  });
  return features;
}

function MapContent() {
  const [center, setCenter] = React.useState(mapConfig.center);
  const [zoom, setZoom] = React.useState(16);

  const [showLayer1, setShowLayer1] = React.useState(true);
  const [showLayer2, setShowLayer2] = React.useState(true);
  const [showMarker, setShowMarker] = React.useState(true); 
  const [features, setFeatures] = React.useState(addMarkers(markersLonLat));
  const [mapType, setMapType] = React.useState('OSM');

  getContext('2d', { willReadFrequently: true });

  let style = function(feature, resolution) { 
    let font_size = 20 * 2.388657133911758 / resolution;
    return new Style({
      stroke: new Stroke({
        color: "black",
        width: 1,
      }),
      fill: new Fill({
        color: "rgba(255, 255, 0, 0.4)",
      }),
      text: new Text({
        font: 'bold ' + font_size + 'px Times New Roman',                    
        text: resolution <= 4.777314267823516 ? mapConfig.geojsonObject.description : '',
      }),
    })
  }

  function getFeatureStyle(feature) {  
    let geometry = feature.getGeometry();
    if (geometry instanceof Circle) {
      return new Style({
        stroke: new Stroke({
          color: "rgba(0, 122, 122)",
          width: 3,
        }),
        fill: new Fill({
          color: "rgba(228, 28, 128, 0.2)",
        }),        
        text: new Text({
          font: "bold italic 15px serif",
          fill: new Fill({
            color: "rgba(0, 122, 122)",
          }),
          text: feature.get("name"),
        })
      })
    } 
    if (geometry instanceof Polygon) {
      return new Style({
        stroke: new Stroke({
          color: "rgba(122, 3, 3)",
          width: 3,
        }),
        fill: new Fill({
          color: "rgba(36, 171, 212, 0.3)",
        }),        
        text: new Text({
          font: "bold italic 15px serif",
          fill: new Fill({
            color: "rgba(122, 3, 3)",
          }),
          text: feature.get("name"),
        })
      })
    } 
    if (geometry instanceof LineString) {
      return new Style({
        stroke: new Stroke({
          color: "rgba(121, 0, 143)",
          width: 3,
        }),     
        text: new Text({
          font: "bold italic 15px serif",
          offsetY: -11,
          placement: "line",
          fill: new Fill({
            color: "rgba(121, 0, 143)",
          }),
          text: feature.get("name"),
        })
      })
    }
    if (geometry instanceof Point) {
      return new Style({
        image: new Icon({
          src: gasIcon,
          scale: 0.07,
        }),
        text: new Text({
          font: "bold italic 15px serif",            
          offsetX: 75,
          fill: new Fill({
            color: blue[900],
          }),
          text: feature.get("name"),
        })
      })
    }
  }

  function loadFeatures() {
    let features = new Collection();  
    /** Начало части с PostGIS */
    fetch("http://localhost:8080/feature/getAll")
      .then(res => res.json())
      .then((result) => result.map(object => {
        let feature = new Feature({
          geometry: new WKT().readGeometry(object[3]),
          featureProjection: get("EPSG:3857"),
          id: object[0],
          name: object[1],
          description: object[2],
        })
        feature.setStyle(getFeatureStyle(feature))
        features.push(feature)
      })) 
    fetch("http://localhost:8080/circle/getAll")
      .then(res => res.json())
      .then((result) => result.map(circle => {
        let feature = new Feature({
          geometry: new Circle(circle.center, circle.radius),
          featureProjection: get("EPSG:3857"),
          id: circle.id,
          name: circle.name,
          description: circle.description,
        })
        feature.setStyle(getFeatureStyle(feature))
        features.push(feature);
      }))
    /** Конец части с PostGIS */
    /** Начало части без PostGIS */
    /*
    fetch("http://localhost:8080/polygon/getAll")
      .then(res => res.json())
      .then((result) => result.map(geometry => {
        let feature = new Feature({
          geometry: new GeoJSON().readGeometry(geometry),
          featureProjection: get("EPSG:3857"),
          description: "Area: " + geometry.size,      
        })
        feature.setStyle(new Style({
          stroke: new Stroke({
            color: "rgba(122, 3, 3)",
            width: 3,
          }),
          fill: new Fill({
            color: "rgba(36, 171, 212, 0.3)",
          }),        
          text: new Text({
            font: "bold italic 15px serif",
            fill: new Fill({
              color: "rgba(122, 3, 3)",
            }),
            text: geometry.name,
          })
        }))
        features.push(feature);
      }))
    fetch("http://localhost:8080/circle/getAll")
      .then(res => res.json())
      .then((result) => result.map(geometry => {
        let feature = new Feature({
          geometry: new Circle(geometry.center, geometry.radius),
          featureProjection: get("EPSG:3857"),
          description: "Area: " + geometry.size,
        })
        feature.setStyle(new Style({
          stroke: new Stroke({
            color: "rgba(0, 122, 122)",
            width: 3,
          }),
          fill: new Fill({
            color: "rgba(228, 28, 128, 0.2)",
          }),        
          text: new Text({
            font: "bold italic 15px serif",
            fill: new Fill({
              color: "rgba(0, 122, 122)",
            }),
            text: geometry.name,
          })
        }))
        features.push(feature);
      }))
    fetch("http://localhost:8080/line/getAll")
      .then(res => res.json())
      .then((result) => result.map(geometry => {
        let feature = new Feature({
          geometry: new GeoJSON().readGeometry(geometry),
          featureProjection: get("EPSG:3857"),
          description: "Length: " + geometry.size,
        });
        feature.setStyle(new Style({
          stroke: new Stroke({
            color: "rgba(121, 0, 143)",
            width: 3,
          }),     
          text: new Text({
            font: "bold italic 15px serif",
            offsetY: -11,
            placement: "line",
            fill: new Fill({
              color: "rgba(121, 0, 143)",
            }),
            text: geometry.name,
          })
        }))
        features.push(feature);
      }))
    fetch("http://localhost:8080/point/getAll")
      .then(res => res.json())
      .then((result) => result.map(geometry => {
        let feature = new Feature({
          geometry: new GeoJSON().readGeometry(geometry),
          featureProjection: get("EPSG:3857"),
          description: geometry.description,
        });
        feature.setStyle(new Style({
          image: new Icon({
            src: gasIcon,
            scale: 0.07,
          }),
          text: new Text({
            font: "bold italic 15px serif",            
            offsetX: 75,
            fill: new Fill({
              color: blue[900],
            }),
            text: geometry.name,
          })
        }));
        features.push(feature);
      }))
      */
    /** Конец части без PostGIS */
    return features;
  }

  return (
    <div>
      <Toolbar/>
      <MapComponent center = {fromLonLat(center)} zoom = {zoom}>
        <Layers>
          {mapType === 'OSM' && <TileLayer source={new olSource.OSM()} zIndex = {0}/>}
          {mapType === 'XYZ' && <TileLayer source={new olSource.XYZ({url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'})} zIndex = {0}/>}
          {showLayer1 && (
            <VectorLayer 
              source={new olSource.Vector({
                features: new GeoJSON().readFeatures(mapConfig.geojsonObject, {
                  featureProjection: get("EPSG:3857"),
                }),
              })}
              style = {style}
            />
          )}
          <VectorLayer 
            zIndex={2}
            source={new olSource.Vector({
              features: loadFeatures(),
            })}
            />                   
          {showLayer2 && (
            <VectorLayer
              source = {new olSource.Vector({
                features: new GeoJSON().readFeatures(mapConfig.geojsonObject2, {
                  featureProjection: get("EPSG:3857"),
                }),
              })}
              style = {
                new Style({
                  stroke: new Stroke({
                    color: "green",
                    width: 5,
                  }),
                  fill: new Fill({
                    color: "rgba(255, 0, 0, 0.7)",
                  }),
                  text: new Text({
                    font: "italic 20px Calibri",
                    text: zoom >= 16 ? mapConfig.geojsonObject2.description : "",
                  })
                })
              }/>
          )}
          {showMarker && <VectorLayer source={new olSource.Vector({ features })}/>}   
        </Layers>
      </MapComponent>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"></link>
      <div className='row'>
        <div className='col-auto'>
          <span className='input-group'>
            <label className='input-group-text' htmlFor='mapType'>Map type:</label>
            <select className='form-select' id='mapType' defaultValue='OSM' onChange={(event) => {setMapType(event.target.value)}}>
              <option value='OSM'>OSM</option>
              <option value='XYZ'>XYZ</option>
            </select>
          </span>
        </div>
        <div className='col-auto'>
          <span className='input-group'>
            <label className="input-group-text" htmlFor="drawType">Geometry type:</label>
            <select className='form-select' id='drawType' defaultValue='None'>          
              <option value='None'>None</option>
              <option value='Point'>Point</option>
              <option value='LineString'>LineString</option>
              <option value='Polygon'>Polygon</option>
              <option value='Circle'>Circle</option>
            </select> 
            <button className='form-control' id='modify'><i className='fa fa-edit'/></button>           
            <button className="form-control" id="undo"><i className='fa fa-undo'/></button>           
          </span>
        </div>
      </div>
      <div className='row'>
        <div className='col-auto'>
          <span className='input-group'>
            <label className='input-group-text' htmlFor='units'>Units:</label>
            <select className='form-select' id='units' defaultValue='metric'>
              <option value='degrees'>degrees</option>
              <option value='imperial'>imperial inches</option>
              <option value='us'>US inches</option>
              <option value='nautical'>nautical miles</option>
              <option value='metric'>metric</option>
            </select>
          </span>
        </div>
        <div className='col-auto'>
          <span className='input-group'>
            <label className='input-group-text' htmlFor='scaleType'>ScaleLine Type:</label> 
            <select className='form-select' id='scaleType' defaultValue='scalebar'>
              <option value='scaleline'>ScaleLine</option> 
              <option value='scalebar'>ScaleBar</option>             
            </select>           
          </span>
        </div>
        <div id='scaleBarOptions' style={{flex: '0 0 auto'}}>
          <label className='input-group-text' htmlFor='steps'>Steps:            
            <input id='steps' type='range' defaultValue='4' min='1' max='8'></input>
            <label>
              <input className='input-checkbox' type='checkbox' id='showScaleText' defaultChecked='true'/> Show scale text
            </label>
            <label>
              <input className='input-checkbox' type='checkbox' id='invertColors'/> Invert colors
            </label>
          </label>          
        </div>
      </div>
      <hr className='hr'/>       
      <div className="map-input-block">
        <input
          type="checkbox"
          checked={showLayer1}
          onChange = {(event) => setShowLayer1(event.target.checked)}/>
        {"  "} Квадрат
      </div>
      <div className="map-input-block">
        <input
          type="checkbox"
          checked={showLayer2}
          onChange = {(event) => setShowLayer2(event.target.checked)}/>
        {"  "} Треугольник
      </div>
      <div className="map-input-block">
        <input
          type="checkbox"
          checked={showMarker}
          onChange = {(event) => setShowMarker(event.target.checked)}/>
        {"  "} Отображать маркеры
      </div>
    </div>
  );
}

export default function Map() {
  return <MapContent/>;
}
