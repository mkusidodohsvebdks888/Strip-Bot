import image from './nono-brand.png';
import './nono-brand.css';

export function NonoBrand({className=''}:{className?:string}) {
  return <span className={'strip-nono-brand '+className} aria-hidden="true">
    <img src={image} alt="" draggable={false}/>
  </span>;
}
