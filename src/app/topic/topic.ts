import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { topics, slugify } from '../data.service'; // adjust path as needed

@Component({
  selector: 'app-topic',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topic.html',
  styleUrl: './topic.css',
})
export class Topic implements OnInit {
  topicId: number = 0;
  title: string = '';
  subTopics: string[] = [];

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('topicId'));
      const topic = topics[id];

      if (slugify(topic.title)) {
        this.title = topic.title;
        this.subTopics = topic.subtopics;
        this.topicId = id;
      } else {
        this.title = 'Topic Not Found';
        this.subTopics = [];
      }
    });
  }
  getSlugify(sub: string) {
    return slugify(sub);
  }
}
