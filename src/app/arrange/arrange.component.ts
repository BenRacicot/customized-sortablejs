import { Component, OnInit } from '@angular/core';
import { AbstractArrangeDirective } from './abstract-arrange.directive';
import Sortable from './sortable/Sortable';

@Component({
  selector: 'app-arrange',
  templateUrl: './arrange.component.html',
  styleUrls: ['./arrange.component.scss'],
  imports: [],
  standalone: true,
})
export class ArrangeComponent
  extends AbstractArrangeDirective
  implements OnInit
{
  ngOnInit() {
    var nestedSortables = [].slice.call(
      document.querySelectorAll('.nested-sortable')
    );

    // Loop through each nested sortable element
    for (var i = 0; i < nestedSortables.length; i++) {
      new Sortable(nestedSortables[i], {
        group: 'nested',
        animation: 150,
        fallbackOnBody: true,
        swapThreshold: 0.65,
      });
    }
  }
}
